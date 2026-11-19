/* Browser adapter. TinySoundFont is kept unmodified in vendor/. */
#define TSF_NO_STDIO
#define TSF_IMPLEMENTATION
#include "vendor/tsf.h"

#define PARTS 32
#define BLOCK 128
static tsf *font, *parts[PARTS];
static int count, drums[PARTS];
static float output[PARTS * BLOCK * 2];

/* Inspect actual SF2 regions, including velocity layers; used for compatibility checks. */
int synth_note_supported(int bank, int program, int key, int velocity)
{
    if (!font) return 0;
    int preset = tsf_get_presetindex(font, bank, program);
    if (preset < 0) return 0;
    struct tsf_preset *p = font->presets + preset;
    for (int i = 0; i < p->regionNum; ++i)
    {
        struct tsf_region *r = p->regions + i;
        if (key >= r->lokey && key <= r->hikey && velocity >= r->lovel && velocity <= r->hivel && r->end > r->offset) return 1;
    }
    return 0;
}

void synth_close(void)
{
    for (int i = 0; i < count; ++i) { tsf_close(parts[i]); parts[i] = 0; }
    count = 0;
    tsf_close(font);
    font = 0;
}

int synth_load(const void *bytes, int length, int rate)
{
    synth_close();
    font = tsf_load_memory(bytes, length);
    if (!font) return 0;
    tsf_set_output(font, TSF_STEREO_INTERLEAVED, rate, -6);
    return 1;
}

int synth_part(int drum)
{
    if (!font || count == PARTS) return -1;
    tsf *p = tsf_copy(font);
    if (!p) return -1;
    if (!tsf_set_max_voices(p, 96) || !tsf_channel_set_presetnumber(p, 0, 0, drum))
    { tsf_close(p); return -1; }
    drums[count] = drum;
    parts[count] = p;
    return count++;
}

void synth_clear_parts(void)
{
    for (int i = 0; i < count; ++i) { tsf_close(parts[i]); parts[i] = 0; }
    count = 0;
}

void synth_reset(int index)
{
    tsf *p = parts[index];
    /* Reset without freeing/reallocating channels on the audio thread. */
    for (int i = 0; i < p->voiceNum; ++i) p->voices[i].playingPreset = -1;
    tsf_channel_midi_control(p, 0, 121, 0);
    tsf_channel_set_sustain(p, 0, 0);
    tsf_channel_set_pitchwheel(p, 0, 8192);
    tsf_channel_set_bank(p, 0, 0);
    tsf_channel_set_presetnumber(p, 0, 0, drums[index]);
}

void synth_silence(int index)
{
    tsf *p = parts[index];
    for (int i = 0; i < p->voiceNum; ++i) p->voices[i].playingPreset = -1;
}

void synth_event(int index, int type, int a, int b)
{
    tsf *p = parts[index];
    switch (type)
    {
        case 0x80: tsf_channel_note_off(p, 0, a); break;
        case 0x90: tsf_channel_note_on(p, 0, a, b / 127.0f); break;
        case 0xb0: tsf_channel_midi_control(p, 0, a, b); break;
        case 0xc0: tsf_channel_set_presetnumber(p, 0, a, drums[index]); break;
        case 0xe0: tsf_channel_set_pitchwheel(p, 0, a | (b << 7)); break;
    }
}

float *synth_render(int frames)
{
    if (frames > BLOCK) frames = BLOCK;
    for (int i = 0; i < count; ++i)
        tsf_render_float(parts[i], output + i * BLOCK * 2, frames, 0);
    return output;
}
