package org.jjazz.web.engine.platform.locks;

/**
 * Tracks reentrant model access in a single worker. Contention is unexpected
 * because song operations are synchronous and must not suspend inside a lock.
 */
public final class ReentrantReadWriteLock
{
    private final ReadLock reader = new ReadLock();
    private final WriteLock writer = new WriteLock();
    private Thread owner;
    private int reads;
    private int writes;

    public ReadLock readLock()
    {
        return reader;
    }

    public WriteLock writeLock()
    {
        return writer;
    }

    public boolean isWriteLockedByCurrentThread()
    {
        return writes != 0 && owner == Thread.currentThread();
    }

    private void acquire()
    {
        Thread current = Thread.currentThread();
        if ((reads != 0 || writes != 0) && owner != current)
        {
            throw new IllegalStateException("A song operation suspended while holding a lock");
        }
        owner = current;
    }

    private void checkRelease(int count)
    {
        if (count == 0 || owner != Thread.currentThread())
        {
            throw new IllegalMonitorStateException("Lock not held by current thread");
        }
    }

    private void releaseIfIdle()
    {
        if (reads == 0 && writes == 0)
        {
            owner = null;
        }
    }

    public final class ReadLock
    {
        public void lock()
        {
            acquire();
            reads++;
        }

        public void unlock()
        {
            checkRelease(reads);
            reads--;
            releaseIfIdle();
        }
    }

    public final class WriteLock
    {
        public void lock()
        {
            acquire();
            if (reads != 0 && writes == 0)
            {
                throw new IllegalStateException("Cannot take a write lock while holding only a read lock");
            }
            writes++;
        }

        public void unlock()
        {
            checkRelease(writes);
            writes--;
            releaseIfIdle();
        }
    }
}
