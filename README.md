# Duolingo Chinese → Anki Bridge

*Automatically capture Chinese vocabulary from Duolingo and create comprehensive Anki flashcards with native audio pronunciation.*


## Complete Workflow

### Step 1: Generate Audio Files
- Use the UserScript on Duolingo to capture vocabulary and download audio

### Step 2: Organize Files (Optional)
- Create folders by section: `Greetings/`, `Food/`, `Travel/`

### Step 3: Generate Anki Flashcards
```bash
# For all audio files
python tools/anki-flashcard-generator.py ~/Downloads/chinese_audio

# For specific section
python tools/anki-flashcard-generator.py ~/Downloads/chinese_audio/Greetings --section "Greetings"
```

## Project Structure
```
duolingo-chinese-anki-bridge/
├── userscripts/
│   └── audio-capture.user.js
├── tools/
│   └── flashcard-generator.py
└── README.md
```
