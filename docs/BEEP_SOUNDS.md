# Background Notify - Alternative Beep Sounds Guide

A comprehensive guide to customizing notification sounds for the background-notify hook.

## Quick Sound Test

Try these sounds in your terminal to find your favorite:

```bash
# macOS - Test all sounds
for sound in Tink Glass Hero Ping Pop Purr Funk Bottle Frog Submarine Basso Sosumi Blow Morse; do
  echo "Playing: $sound"
  afplay "/System/Library/Sounds/${sound}.aiff"
  sleep 1
done
```

## Available Sounds (macOS)

### 🌟 Top Picks

| Sound | Character | Best For | Path |
|-------|-----------|----------|------|
| **Glass** ⭐ | Bright crystalline chime | Success notifications | `/System/Library/Sounds/Glass.aiff` |
| **Hero** ⭐ | Triumphant ascending notes | Long-running tasks | `/System/Library/Sounds/Hero.aiff` |
| **Tink** | Light single chime (current) | General purpose | `/System/Library/Sounds/Tink.aiff` |

### 😌 Subtle Options

| Sound | Character | Best For |
|-------|-----------|----------|
| **Purr** | Gentle, soft | Quiet environments |
| **Pop** | Quick, minimal | Frequent notifications |
| **Ping** | Sonar-like | Background awareness |

### 🎉 Playful Options

| Sound | Character | Best For |
|-------|-----------|----------|
| **Funk** | Funky bass note | Personal projects |
| **Bottle** | Hollow resonance | Quirky personality |
| **Frog** | Ribbit | Humor |
| **Submarine** | Sonar sequence | Nostalgia |

### ⚠️ Attention-Demanding

| Sound | Character | Best For |
|-------|-----------|----------|
| **Basso** | Deep error tone | Critical tasks |
| **Sosumi** | Classic Mac chime | Important completions |
| **Blow** | Wind gust | Unusual alert |
| **Morse** | Morse code beeps | Technical feel |

## Recommendations by Context

### 👔 Professional/Office
```json
{
  "backgroundNotify": {
    "beep": true,
    "beepSound": "purr"
  }
}
```
**Why:** Quiet, won't disturb colleagues

### 🏠 Home/Personal
```json
{
  "backgroundNotify": {
    "beep": true,
    "beepSound": "glass"
  }
}
```
**Why:** Satisfying without being annoying

### 🚀 Development/Build Tasks
```json
{
  "backgroundNotify": {
    "beep": true,
    "beepSound": "hero",
    "thresholdMs": 30000
  }
}
```
**Why:** Celebrate long build completions

### ⚡ Frequent Quick Tasks
```json
{
  "backgroundNotify": {
    "beep": true,
    "beepSound": "pop",
    "thresholdMs": 2000
  }
}
```
**Why:** Minimal, won't get annoying

## Custom Sound Setup

### Use Any Sound File

```json
{
  "backgroundNotify": {
    "enabled": true,
    "beep": true,
    "beepSound": "custom",
    "beepSoundPath": "/Users/you/Sounds/custom-beep.aiff"
  }
}
```

### Create Custom Sound

**Option 1: Record your own**
```bash
# macOS - Record 1 second
sox -d custom-beep.aiff trim 0 1
```

**Option 2: Convert from MP3/WAV**
```bash
# Using ffmpeg
ffmpeg -i input.mp3 -t 1 custom-beep.aiff
```

**Option 3: Download from freesound.org**
- Search for notification sounds
- Download as WAV or AIFF
- Place in your sounds directory

## Linux Sound Options

### Default Sounds

```json
{
  "backgroundNotify": {
    "beep": true,
    "beepSound": "complete"
  }
}
```

Available Linux sounds:
- `bell` - Standard system bell
- `complete` - Completion sound
- `message` - Message notification
- `custom` - Use `beepSoundPath`

### Common Linux Paths

```
/usr/share/sounds/freedesktop/stereo/
├── bell.oga
├── complete.oga
├── message.oga
└── dialog-error.oga

/usr/share/sounds/ubuntu/stereo/
├── notification.ogg
├── phone-incoming-call.ogg
└── message-new-instant.ogg
```

## Testing Sounds

### Interactive Test Script

```bash
#!/bin/bash
# Save as test-sounds.sh

sounds=(Tink Glass Hero Ping Pop Purr Funk Bottle Frog Submarine Basso Sosumi Blow Morse)

echo "🔊 Background Notify Sound Tester"
echo "=================================="
echo ""

for sound in "${sounds[@]}"; do
    path="/System/Library/Sounds/${sound}.aiff"
    if [ -f "$path" ]; then
        echo -n "▶️  $sound: "
        afplay "$path"
        read -p "   Like it? (y/n/q to quit): " choice
        case "$choice" in
            y|Y) echo "   ✓ Add to settings: \"beepSound\": \"${sound,,}\"" ;;
            q|Q) echo "Exiting."; exit 0 ;;
        esac
        echo ""
    fi
done

echo "✨ Test complete!"
```

### Quick Test in Terminal

```bash
# Test a specific sound
afplay /System/Library/Sounds/Glass.aiff

# Test with pi settings format
echo '{"backgroundNotify":{"beepSound":"glass"}}' | \
  jq '.backgroundNotify.beepSound' -r | \
  xargs -I {} afplay /System/Library/Sounds/{^}.aiff
```

## Implementation Note

**Current Status:** The background-notify hook currently uses a hardcoded `Tink.aiff` sound.

**To add sound selection:**
The hook would need to be updated to:
1. Add `beepSound` and `beepSoundPath` to config interface
2. Create a sound mapping function
3. Update the `playBeep()` function to use configured sound

**Would you like me to implement this enhancement?** It would add:
- Configurable sound selection
- Custom sound file support
- Platform-specific sound mappings
- Backward compatibility (defaults to Tink)

## Sound Personality Matrix

| If you like... | Try these sounds | Personality |
|----------------|------------------|-------------|
| Minimalist design | Pop, Purr, Tink | Clean & Simple |
| macOS classics | Sosumi, Basso | Nostalgic |
| Playful coding | Funk, Bottle, Frog | Fun & Creative |
| Sci-fi vibes | Submarine, Morse, Ping | Technical |
| Rewarding feedback | Hero, Glass | Achievement |

## Pro Tips

1. **Match threshold to sound**
   - Short tasks (2-5s) → Subtle sounds (Pop, Purr)
   - Long tasks (30s+) → Rewarding sounds (Hero, Glass)

2. **Environment matters**
   - Open office → Purr or disable beep
   - Private office → Any sound you enjoy
   - Late night → Purr or Pop (neighbors!)

3. **Task type variation**
   - Tests → Pop (quick feedback)
   - Builds → Hero (celebration)
   - Deployments → Glass (success feeling)

4. **Frequency consideration**
   - High frequency tasks → Minimal sounds
   - Rare events → Attention-getting sounds

## Example Configurations

### The Developer

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 3000,
    "beep": true,
    "beepSound": "glass",
    "bringToFront": true
  }
}
```

### The Minimalist

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "beepSound": "pop",
    "bringToFront": false
  }
}
```

### The Enthusiast

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 10000,
    "beep": true,
    "beepSound": "hero",
    "bringToFront": true
  }
}
```

### The Night Owl

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "beepSound": "purr",
    "bringToFront": true
  }
}
```

## Conclusion

The right notification sound can make task completion more satisfying and help you stay in flow. Start with **Glass** for a universally pleasant sound, or **Hero** if you want celebration vibes.

Try the test script above to find your perfect match! 🎵
