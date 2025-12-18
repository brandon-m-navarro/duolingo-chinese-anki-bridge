# Duolingo Chinese → Anki Bridge

*Automatically capture Chinese vocabulary from Duolingo and create Anki flashcards with English translation, Hanzi, Pinyin, audio.*

## DEMO

https://github.com/user-attachments/assets/5354b8b9-b500-4ce4-9004-7771c4e32403



## Complete Workflow

### Step 0: Download the Tampermonkey Chrome Extension
- In order to run userscripts, you need [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en). Userscripts are small programs that modify page layouts, add or remove features, and automate actions. The userscript I wrote reverse-engineers the Duolingo DOM structure to extract vocabulary context, then uses free TTL APIs to create a new audio file of the selected Hanzi, which is then downloaded. This falls within Duolingo's TOS as it uses TTS instead of Duolingo's copyrighted audio.

### Step 1: Generate Audio Files
- Use the UserScript on Duolingo to capture vocabulary and download TTS equivalent audio. If you have a Google Cloud API Key, you can enter it by selecting the `TTS Config` button. Don't worry if you don't have one, as there are a number of free fallbacks that can be used that produce high-quality audio files.

<img width="2606" height="1512" alt="image" src="https://github.com/user-attachments/assets/8d055809-c107-4d93-895b-e4f304ed69dd" />


### Step 2: Organize Files (Optional)
- Create folders by section: `Greetings/`, `Food/`, `Travel/`, `Lesson 1.1/`


### Step 3: Generate CSV for Anki Flashcards
If you want to organize your flashcards into decks, group the downloaded audio files into different folders and run the script on each one. Using the -s flag here will help carry that organization forward into the next steps.

If you don't need your cards organized into specific sections, simply omit the flag. You can then run the script directly on your /Downloads folder, as it will only look for MP3 files following the hanzi-pinyin-english.mp3 naming convention.

```bash
# Example 1: Process all files in Downloads without organization
python tools/anki-flashcard-generator.py ~/Downloads

# Example 2: Process files in a specific folder and tag them as "Greetings"
python tools/anki-flashcard-generator.py path/to/audiofiles -s "Greetings"
```

### Step 4: Download Anki & Configure Fields
Using [Anki](https://apps.ankiweb.net/), a free-to-use flashcard app, you can import the created CSV file (or multiple CSVs if you used the -s flag for organization).

BEFORE IMPORTING: You need to make sure Anki is expecting the four fields (Hanzi, Pinyin, Audio, English). You can easily set this up by clicking the 'ADD' button on the main screen, then selecting your note type and clicking `Fields...`. Add the necessary fields so the configuration looks like this:

<img width="752" height="532" alt="Screen Shot 2025-10-30 at 12 27 56 AM" src="https://github.com/user-attachments/assets/bf173dc3-e1e1-4d03-a95d-47b244be5d72" />

### Step 5: Import CSV
Now you are ready to import. From Anki, select "Import File" and find the CSV you created earlier. Make sure to double check the field seperator is 'Comma' and the box for 'Allow HTML' is checked.

<img width="724" height="360" alt="Screen Shot 2025-10-30 at 12 29 15 AM" src="https://github.com/user-attachments/assets/cb31e1bf-bc9c-4299-be35-e774703f43a0" />

And make sure you Field Mappings are matching.

<img width="723" height="274" alt="Screen Shot 2025-10-30 at 12 29 31 AM" src="https://github.com/user-attachments/assets/6b4e9aba-ecc9-49a4-95f5-fb52f31e025f" />


### Step 6: Create Card Types
Almost there! Since we have four fields, we can create four different card templates.

To do this, go to Tools -> Manage Note Types in the toolbar. If you didn't change the name, your custom type was likely saved under a "Basic" profile. You can verify this by selecting it and clicking the Fields button. To avoid confusion, I recommend renaming it to something like 'Chinese'.

Once you've found your custom note type, highlight it and click Cards. This is where you'll define the card templates. Below are the templates I used:
```
Card Templates:
Card 1: Hanzi → Pinyin + English + Audio

Front: 你好

Back: nǐ hǎo
hello
[Sound]

Card 2: Pinyin → Hanzi + English

Front: nǐ hǎo

Back: 你好
hello

Card 3: English → Hanzi + Pinyin

Front: hello

Back: 你好
nǐ hǎo

Card 4: Audio → Hanzi + Pinyin + English

Front: [Sound]

Back: 你好
nǐ hǎo
hello
```
This is where you define what appears on the front and back of your cards, as well as style them using CSS.

In the /templates section, you'll find the Styling area where you can paste the CSS, and the Front Template / Back Template areas for the HTML.

Since we have four templates, you need to create a new Card Type for each one. You can do this easily by clicking the Options button near the top and selecting Add Card Type. The CSS is shared across all Card Types, so you only need to update the HTML for the Front Template and Back Template in each one.

Here is the styling I used for Card 1: Hanzi → Pinyin + English + Audio:

FRONT:
<img width="965" height="857" alt="Screen Shot 2025-10-30 at 12 45 42 AM" src="https://github.com/user-attachments/assets/7543e90b-342b-4a9e-8d6d-92cb01d795f0" />

BACK:
<img width="965" height="857" alt="Screen Shot 2025-10-30 at 12 40 09 AM" src="https://github.com/user-attachments/assets/3cbcdd8f-e2c9-4d58-89b1-7350b017245e" />


## Further Tips

Flashcards achieved! Just a quick note: make sure you don't delete your 'Default' deck, as it acts as the database for all your cards. By default, this deck will contain every Card Type we created.

Now, let's say you only want to practice English → Hanzi + Pinyin. You can easily create a filtered deck that contains just a single Card Type.

Here's how:

Go to Tools -> Create Filtered Deck on the Anki toolbar (or simply press F on your keyboard).

In the search box, enter a filter like card:"Card 1" (using whatever name you gave your Card Type in Step 6).

#### If Audio is not playing

Usually, Anki will import audio files without a problem, but if you notice the audio is not working on your cards, the fix is very easy. You need to add all your audio files to Anki's collection.media folder.

This folder is usually located in Library/Application Support/, but you can find it easily within Anki. From the main toolbar, select Tools -> Add-ons. In the window that opens, select View Files. This will open your /addons folder. Navigate up one level (to the parent folder), and you should see the collection.media folder there. Copy and paste your audio files into this folder, and the issue should be resolved.


## Project Structure
```
duolingo-chinese-anki-bridge/
├── userscripts/
│   └── audio-capture.user.js
├── tools/
│   └── flashcard-generator.py
└── README.md
```
