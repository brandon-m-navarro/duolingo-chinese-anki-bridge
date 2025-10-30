#!/usr/bin/env python3
"""
Anki Flashcard Generator for Duolingo Chinese TTS Audio Files
Creates CSV with 4 card types from audio files named: hanzi-pinyin-translation.mp3
"""

import os
import re
import csv
import argparse
from pathlib import Path
from datetime import datetime

def parse_audio_filename(filename):
    """Parse filename like '你好-ni_hao-hello.mp3' into components"""
    base_name = filename.replace('.mp3', '')
    parts = base_name.split('-')
    
    if len(parts) < 3:
        raise ValueError(f"Invalid filename format: {filename}")
    
    hanzi = parts[0]
    pinyin = parts[1]
    translation = '-'.join(parts[2:])  # Handle translations with hyphens
    
    return {
        'hanzi': hanzi,
        'pinyin': pinyin,
        'translation': translation,
        'audio': filename
    }

def generate_anki_csv(audio_directory, output_file, tag=None):
    """Generate Anki CSV from audio files in directory"""
    
    audio_files = [f for f in os.listdir(audio_directory) if f.endswith('.mp3')]
    
    if not audio_files:
        print("No MP3 files found in directory")
        return
    
    notes = []
    for audio_file in audio_files:
        try:
            vocab = parse_audio_filename(audio_file)
            notes.append(vocab)
        except ValueError as e:
            print(f"Skipping {audio_file}: {e}")
    
    # Generate CSV for Anki import
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        # Write header
        headers = ['Hanzi', 'Pinyin', 'English', 'Audio', 'Tags']
        writer.writerow(headers)
        
        # Write notes
        for note in notes:
            row = [
                note['hanzi'],
                note['pinyin'], 
                note['translation'],
                f"[sound:{note['audio']}]",
                tag or f"Duolingo-{datetime.now().strftime('%Y-%m-%d')}"
            ]
            writer.writerow(row)
    
    print(f"Generated {len(notes)} flashcards in {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Generate Anki flashcards from Chinese TTS audio files')
    parser.add_argument('audio_dir', help='Directory containing audio files')
    parser.add_argument('--output', '-o', default='anki_flashcards.csv', 
                       help='Output CSV filename')
    parser.add_argument('--tag', '-t', help='Anki tag for the flashcards')
    parser.add_argument('--section', '-s', help='Duolingo section name for tagging')
    
    args = parser.parse_args()
    
    # Auto-generate tag if section provided
    tag = args.tag
    if not tag and args.section:
        tag = f"Duolingo::{args.section}"
    
    generate_anki_csv(args.audio_dir, args.output, tag)

if __name__ == '__main__':
    main()
