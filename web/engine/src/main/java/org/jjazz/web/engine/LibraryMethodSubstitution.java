package org.jjazz.web.engine;

import org.jjazz.web.engine.platform.logging.WebLog;
import org.jjazz.web.engine.platform.util.SortedSetViews;
import org.teavm.model.ClassHolder;
import org.teavm.model.ClassHolderTransformer;
import org.teavm.model.ClassHolderTransformerContext;
import org.teavm.model.MethodReference;
import org.teavm.model.Program;
import org.teavm.model.instructions.ExitInstruction;
import org.teavm.model.instructions.InvocationType;
import org.teavm.model.instructions.InvokeInstruction;

/** Redirects individual JDK calls where replacing the whole class would be too broad. */
public final class LibraryMethodSubstitution implements ClassHolderTransformer
{
    @Override
    public void transformClass(ClassHolder cls, ClassHolderTransformerContext context)
    {
        for (var method : cls.getMethods())
        {
            if (cls.getName().equals("org.jjazz.songstructure.SongStructureImpl")
                    && method.getDescriptor().toString().equals("generateAllAdaptedRhythms()V"))
            {
                // This desktop task warms a rhythm catalog. Generation accepts a selected style.
                var empty = new Program();
                empty.createVariable();
                empty.createBasicBlock().add(new ExitInstruction());
                method.setProgram(empty);
                continue;
            }
            var program = method.getProgram();
            if (program == null)
            {
                continue;
            }
            for (int i = 0; i < program.basicBlockCount(); i++)
            {
                for (var insn : program.basicBlockAt(i))
                {
                    if (insn instanceof InvokeInstruction call)
                    {
                        var target = call.getMethod();
                        if (cls.getName().startsWith("org.jjazz.") && call.getInstance() != null
                                && target.getClassName().equals("java.util.logging.Logger"))
                        {
                            // TeaVM already provides this class. Redirect its instance operations
                            // before classlib linkage to keep desktop trace logging off.
                            call.setInstance(null);
                            call.setType(InvocationType.SPECIAL);
                            call.setMethod(new MethodReference(WebLog.class.getName(), target.getDescriptor()));
                            continue;
                        }
                        String replacement = replacementOwner(target);
                        if (replacement != null)
                        {
                            call.setMethod(new MethodReference(replacement, target.getDescriptor()));
                        }
                    }
                }
            }
        }
    }

    private static String replacementOwner(MethodReference target)
    {
        return switch (target.getClassName())
        {
            case "java.util.Collections" -> switch (target.getName())
            {
                case "unmodifiableSortedSet", "unmodifiableNavigableSet" -> SortedSetViews.class.getName();
                default -> null;
            };
            case "org.jjazz.midi.api.MidiUtilities" -> target.getName().equals("checkMidiFileTypeSupport")
                    ? EnginePlatformMethods.class.getName() : null;
            case "org.jjazz.midimix.api.MidiMix" -> target.getName().equals("loadFromFile")
                    ? EnginePlatformMethods.class.getName() : null;
            case "org.jjazz.outputsynth.spi.OutputSynthManager" -> target.getName().equals("getDefault")
                    ? GmOutputSynthManager.class.getName() : null;
            case "org.netbeans.api.progress.BaseProgressUtils" -> target.getDescriptor().toString()
                    .equals("showProgressDialogAndRun(Ljava/lang/Runnable;Ljava/lang/String;)V")
                    ? EnginePlatformMethods.class.getName() : null;
            default -> null;
        };
    }
}
