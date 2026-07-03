/**
 * Suno 音乐风格关键词库
 *
 * 来源：Suno V5 官方文档 + 社区实测 + 手册附录
 * 用途：MBTI prompt 构造时的风格选择参考
 *
 * 分类：
 *   1. 电子/舞曲
 *   2. 流行
 *   3. 摇滚/独立
 *   4. 爵士/布鲁斯
 *   5. 民谣/原声
 *   6. 嘻哈/说唱
 *   7. R&B/Soul
 *   8. 古典/电影配乐
 *   9. 中国/亚洲
 *  10. 世界音乐
 *  11. 氛围/实验
 *  12. 特殊风格（复古/小众）
 *  13. 制作质感修饰词
 *  14. 情绪修饰词
 *  15. 乐器关键词
 *  16. BPM 参考
 */

// ═══════════════════════════════════════
//  1. 电子 / 舞曲
// ═══════════════════════════════════════
export const ELECTRONIC = {
  'House 体系': [
    'House', 'Deep House', 'Tech House', 'Progressive House', 'Future House',
    'Melodic House', 'Afro House', 'Organic House', 'Minimal House',
    'Jackin House', 'Funky House', 'Electro House', 'Big Room House',
    'Slap House', 'Bass House', 'Electro Swing',
  ],
  'Techno 体系': [
    'Techno', 'Minimal Techno', 'Peak Time Techno', 'Industrial Techno',
    'Melodic Techno', 'Dub Techno', 'Acid Techno', 'Hard Techno',
    'Schranz', 'Hypnotic Techno',
  ],
  'Bass 体系': [
    'Dubstep', 'Riddim', 'Future Bass', 'Trap', 'Drum And Bass', 'Jungle',
    'Breakbeat', 'Footwork', 'Grime', 'UK Garage', '2-Step',
    'Bass House', 'Wave',
  ],
  'Trance 体系': [
    'Trance', 'Progressive Trance', 'Uplifting Trance', 'Psytrance',
    'Goa Trance', 'Ambient Trance', 'Vocal Trance',
  ],
  'Chill 体系': [
    'Lo-Fi Hip Hop', 'Chillhop', 'Chillwave', 'Downtempo', 'Trip Hop',
    'Chillstep', 'Lo-Fi Beats', 'Study Beats',
  ],
  '复古电子': [
    'Synthwave', 'Retrowave', 'Outrun', 'Vaporwave', 'Future Funk',
    'City Pop', 'Japanese City Pop', '80s Synth Pop', 'Electropop',
    'Italo Disco', 'Spacesynth', 'Nu Disco', 'Disco',
  ],
  '实验电子': [
    'IDM', 'Glitch', 'Glitch Hop', 'Wonky', 'Experimental Electronic',
    'Modular Synth', 'Generative Music', 'Granular', 'Microsound',
    'Noise', 'Power Noise', 'Rhythmic Noise',
  ],
  '其他电子': [
    'Electronica', 'Ambient Electronic', 'Downtempo Electronic',
    'Electro', 'Electroclash', 'Industrial', 'EBM', 'Darkwave',
    'Synthpop', 'Electropunk', 'Dance Pop', 'EDM',
  ],
};

// ═══════════════════════════════════════
//  2. 流行
// ═══════════════════════════════════════
export const POP = {
  '华语流行': [
    'Mandarin Pop', 'C-Pop', 'Canton-pop', 'Mandopop',
    'Chinese R&B', 'Chinese Folk Pop',
  ],
  '日韩流行': [
    'J-Pop', 'K-Pop', 'City Pop', 'Anime Song', 'J-Rock',
    'Korean R&B', 'Korean Hip Hop', 'Trot',
  ],
  '欧美流行': [
    'Pop', 'Synth Pop', 'Electropop', 'Dance Pop', 'Power Pop',
    'Art Pop', 'Chamber Pop', 'Baroque Pop', 'Psychedelic Pop',
    'Dream Pop', 'Tropical Pop', 'Bedroom Pop', 'Indie Pop',
    'Pop Punk', 'Pop Rock', 'Folk Pop', 'Country Pop',
  ],
  '年代流行': [
    '60s Pop', '70s Pop', '80s Pop', '90s Pop', '2000s Pop',
    'Y2K Pop', 'Boy Band', 'Girl Group',
  ],
};

// ═══════════════════════════════════════
//  3. 摇滚 / 独立
// ═══════════════════════════════════════
export const ROCK = {
  '主流摇滚': [
    'Rock', 'Classic Rock', 'Hard Rock', 'Alternative Rock',
    'Indie Rock', 'Punk Rock', 'Pop Punk', 'Post-Punk',
    'Garage Rock', 'Stoner Rock', 'Desert Rock',
  ],
  '重型': [
    'Metal', 'Heavy Metal', 'Death Metal', 'Black Metal',
    'Thrash Metal', 'Doom Metal', 'Progressive Metal',
    'Metalcore', 'Post-Metal', 'Symphonic Metal',
    'Nu Metal', 'Industrial Metal', 'Folk Metal',
  ],
  '另类/独立': [
    'Shoegaze', 'Post-Rock', 'Math Rock', 'Noise Rock',
    'Grunge', 'Britpop', 'Emo', 'Screamo', 'Midwest Emo',
    'Emo Rap', 'Slowcore', 'Sadcore', 'Slacker Rock',
  ],
  '蓝调/根源': [
    'Blues Rock', 'Southern Rock', 'Country Rock', 'Folk Rock',
    'Roots Rock', 'Rockabilly', 'Psychobilly',
  ],
};

// ═══════════════════════════════════════
//  4. 爵士 / 布鲁斯
// ═══════════════════════════════════════
export const JAZZ = {
  '爵士': [
    'Jazz', 'Smooth Jazz', 'Bebop', 'Cool Jazz', 'Fusion',
    'Free Jazz', 'Funk Jazz', 'Acid Jazz', 'Nu Jazz',
    'Jazz Rap', 'Jazz Funk', 'Jazz Fusion',
    'Big Band', 'Swing', 'Dixieland',
  ],
  '布鲁斯/Soul': [
    'Blues', 'Electric Blues', 'Delta Blues', 'Chicago Blues',
    'Blues Rock', 'Soul', 'Neo-Soul', 'Contemporary R&B',
    'Funk', 'G-Funk', 'P-Funk',
  ],
};

// ═══════════════════════════════════════
//  5. 民谣 / 原声
// ═══════════════════════════════════════
export const FOLK = {
  '民谣': [
    'Folk', 'Indie Folk', 'Contemporary Folk', 'Folk Rock',
    'Folk Pop', 'Anti-Folk', 'Freak Folk', 'Psych Folk',
    'Chamber Folk', 'Celtic Folk', 'Nordic Folk',
  ],
  '原声': [
    'Acoustic', 'Acoustic Pop', 'Acoustic Rock', 'Singer Songwriter',
    'Unplugged', 'Coffeehouse', 'Coffee Shop Music',
  ],
  '乡村': [
    'Country', 'Country Pop', 'Country Rock', 'Alt-Country',
    'Americana', 'Bluegrass', 'Outlaw Country', 'Honky Tonk',
    'Cowboy', 'Western',
  ],
  '世界民谣': [
    'Celtic', 'Irish Folk', 'Scottish Folk', 'Bossa Nova',
    'Flamenco', 'Fado', 'Rebetiko', 'Klezmer',
  ],
};

// ═══════════════════════════════════════
//  6. 嘻哈 / 说唱
// ═══════════════════════════════════════
export const HIPHOP = {
  '经典': [
    'Hip Hop', 'Boom Bap', 'East Coast Hip Hop', 'West Coast Hip Hop',
    'Southern Hip Hop', 'Midwest Hip Hop',
  ],
  '现代': [
    'Trap', 'Drill', 'Cloud Rap', 'Emo Rap', 'Mumble Rap',
    'SoundCloud Rap', 'Plugg', 'Rage', 'Hyperpop Rap',
  ],
  '融合': [
    'Jazz Rap', 'Conscious Hip Hop', 'Political Hip Hop',
    'Alternative Hip Hop', 'Experimental Hip Hop',
    'Lofi Hip Hop', 'Chillhop', 'Trip Hop',
  ],
  '中文说唱': [
    'Chinese Hip Hop', 'Mandarin Rap', 'Cantonese Rap',
    'Chinese Trap', 'Chinese Drill',
  ],
};

// ═══════════════════════════════════════
//  7. R&B / Soul
// ═══════════════════════════════════════
export const RNB = {
  'R&B': [
    'R&B', 'Contemporary R&B', 'Alternative R&B', 'PBR&B',
    'Dark R&B', 'Indie R&B', 'Progressive R&B',
  ],
  'Soul': [
    'Soul', 'Neo-Soul', 'Psychedelic Soul', 'Chamber Soul',
    'Northern Soul', 'Southern Soul', 'Memphis Soul',
  ],
  'Funk': [
    'Funk', 'Electro Funk', 'Nu Funk', 'Jazz Funk',
    'P-Funk', 'G-Funk', 'Funk Rock',
  ],
};

// ═══════════════════════════════════════
//  8. 古典 / 电影配乐
// ═══════════════════════════════════════
export const CLASSICAL = {
  '古典': [
    'Classical', 'Baroque', 'Romantic', 'Impressionist',
    'Modern Classical', 'Contemporary Classical', 'Minimalist',
    'Neoclassical', 'Post-Minimalist',
  ],
  '电影/游戏配乐': [
    'Cinematic', 'Film Score', 'Soundtrack', 'Epic Orchestral',
    'Hybrid Orchestral', 'Dark Cinematic', 'Adventure Score',
    'Horror Score', 'Sci-Fi Score', 'Fantasy Score',
    'Game Soundtrack', 'Epic Game Soundtrack',
  ],
  '合唱/宗教': [
    'Choir', 'Gregorian Chant', 'Sacred', 'Gospel',
    'A Cappella', 'Choral', 'Spiritual',
  ],
};

// ═══════════════════════════════════════
//  9. 中国 / 亚洲
// ═══════════════════════════════════════
export const ASIAN = {
  '中国': [
    'Chinese Traditional', 'Chinese Classical', 'Chinese Opera',
    'Guzheng', 'Erhu', 'Pipa', 'Dizi', 'Suona',
    'Chinese Folk', 'Chinese Pop', 'Chinese Rock',
    'Chinese Electronic', 'Chinese Hip Hop',
    'C-Pop', 'Cantopop', 'Mandopop', 'Hokkien Pop',
  ],
  '日本': [
    'J-Pop', 'J-Rock', 'J-Core', 'City Pop', 'Shibuya-Kei',
    'Visual Kei', 'Enka', 'Japanese Traditional',
    'Koto', 'Shakuhachi', 'Taiko', 'Tsugaru Shamisen',
    'Anime Song', 'Vocaloid',
  ],
  '韩国': [
    'K-Pop', 'Korean R&B', 'Korean Hip Hop', 'Korean Rock',
    'Korean Ballad', 'Trot', 'Gayageum',
  ],
  '东南亚': [
    'Thai Pop', 'Vietnamese Pop', 'Indonesian Pop',
    'Filipino Pop', 'Malay Pop',
  ],
};

// ═══════════════════════════════════════
//  10. 世界音乐
// ═══════════════════════════════════════
export const WORLD = {
  '拉丁': [
    'Latin', 'Salsa', 'Bachata', 'Reggaeton', 'Cumbia',
    'Samba', 'Bossa Nova', 'Tango', 'Latin Pop',
    'Latin Rock', 'Latin Jazz', 'Merengue', 'Lambada',
    'Baile Funk', 'Kuduro',
  ],
  '非洲': [
    'Afrobeat', 'Afropop', 'Highlife', 'Soukous',
    'Mbalax', 'Amapiano', 'Afro House', 'African Percussion',
  ],
  '中东': [
    'Middle Eastern', 'Arabic', 'Turkish', 'Persian',
    'Oud', 'Darbuka', 'Maqam', 'Rai',
  ],
  '印度': [
    'Indian Classical', 'Bollywood', 'Bhangra', 'Carnatic',
    'Hindustani', 'Sitar', 'Tabla', 'Raga',
  ],
};

// ═══════════════════════════════════════
//  11. 氛围 / 实验
// ═══════════════════════════════════════
export const AMBIENT = {
  '氛围': [
    'Ambient', 'Dark Ambient', 'Space Ambient', 'Drone',
    'Ambient Electronic', 'Ambient Pop', 'Ambient Techno',
    'New Age', 'Meditation', 'Healing',
  ],
  '实验': [
    'Experimental', 'Avant-Garde', 'Noise', 'Sound Collage',
    'Musique Concrète', 'Field Recording', 'Electroacoustic',
    'Minimal', 'Microtonal',
  ],
  '先锋': [
    'Post-Industrial', 'Japanoise', 'Power Electronics',
    'Death Industrial', 'Dark Ambient', 'Black Ambient',
  ],
};

// ═══════════════════════════════════════
//  12. 特殊风格（复古/小众/场景）
// ═══════════════════════════════════════
export const SPECIAL = {
  '复古': [
    'Vintage', 'Retro', '60s', '70s', '80s', '90s',
    'Y2K', 'Boogie', 'Italo Disco', 'Eurobeat',
    'City Pop', 'AOR', 'Smooth FM',
  ],
  '场景音乐': [
    'Elevator Music', 'Muzak', 'Bossa Nova Elevator',
    'Shopping Mall Music', 'Weather Channel Music',
    'Hold Music', 'Lounge', 'Exotica', 'Library Music',
  ],
  '恐怖/悬疑': [
    'Horror Ambient', 'Dark Ambient', 'Suspense',
    'Unsettling', 'Creepy', 'Psychological Horror',
    'Sound Design', 'Foley', 'Dark Soundtrack',
  ],
  '游戏/动漫': [
    'Chiptune', '8-bit', '16-bit', 'Video Game Music',
    'RPG Soundtrack', 'Platformer Music', 'Boss Battle',
    'Anime OST', 'Visual Novel OST',
  ],
  'ASMR/亲密': [
    'ASMR', 'Whisper', 'Binaural', 'Close Mic',
    'Intimate Recording', 'Bedroom Pop', 'Whisper Pop',
  ],
};

// ═══════════════════════════════════════
//  13. 制作质感修饰词
// ═══════════════════════════════════════
export const PRODUCTION = {
  '音质': [
    'Hi-Fi', 'Lo-Fi', 'Polished', 'Raw', 'Vintage',
    'Analog', 'Digital', 'Warm', 'Crisp', 'Clean',
    'Muddy', 'Punchy', 'Spacious', 'Dry', 'Wet',
  ],
  '制作方式': [
    'Bedroom Recording', 'Studio Recording', 'Live Recording',
    'Live In Studio', 'Rehearsal Room', 'Garage Recording',
    'Stairwell Recording', 'Concert Hall',
  ],
  '混音风格': [
    'Punchy Mix', 'Balanced Mix', 'Wide Stereo', 'Mono Compatible',
    'Compressed', 'Dynamic Range Wide', 'Mastered',
    'Uncompressed', 'Loud', 'Quiet', 'Intimate Mix',
  ],
  '效果': [
    'Reverb', 'Reverb-Soaked', 'Delay', 'Tape Delay',
    'Ping Pong Delay', 'Slapback Delay', 'Gated Reverb',
    'Chorus Effect', 'Phaser', 'Flanger', 'Tremolo',
    'Sidechain Pumping', 'Filter Sweep', 'Reverse Reverb',
    'Bitcrushed', 'Vinyl Crackle', 'Tape Warmth',
  ],
};

// ═══════════════════════════════════════
//  14. 情绪修饰词
// ═══════════════════════════════════════
export const MOOD = {
  '正面': [
    'Uplifting', 'Euphoric', 'Joyful', 'Cheerful', 'Playful',
    'Triumphant', 'Empowering', 'Hopeful', 'Optimistic',
    'Blissful', 'Serene', 'Peaceful', 'Relaxing', 'Comforting',
    'Romantic', 'Dreamy', 'Nostalgic', 'Bittersweet',
  ],
  '中性': [
    'Introspective', 'Contemplative', 'Meditative', 'Calm',
    'Focused', 'Determined', 'Confident', 'Cool', 'Groovy',
    'Hypnotic', 'Atmospheric', 'Mysterious', 'Suspenseful',
  ],
  '负面': [
    'Melancholic', 'Somber', 'Dark', 'Brooding', 'Ominous',
    'Haunting', 'Aggressive', 'Angry', 'Frustrated', 'Tense',
    'Anxious', 'Unsettling', 'Disturbing', 'Desolate',
    'Lonely', 'Heartbreaking', 'Grieving', 'Bitter',
  ],
  '强度': [
    'Gentle', 'Soft', 'Mellow', 'Laid-Back', 'Chill',
    'Moderate', 'Energetic', 'Dynamic', 'Powerful',
    'Intense', 'Explosive', 'Aggressive', 'Extreme',
  ],
};

// ═══════════════════════════════════════
//  15. 乐器关键词
// ═══════════════════════════════════════
export const INSTRUMENTS = {
  '弦乐': [
    'Acoustic Guitar', 'Electric Guitar', 'Clean Guitar',
    'Distorted Guitar', 'Nylon Guitar', '12-String Guitar',
    'Slide Guitar', 'Fingerpicking', 'Fingerstyle',
    'Violin', 'Viola', 'Cello', 'Double Bass',
    'Strings', 'String Quartet', 'String Orchestra',
    'Pizzicato', 'Erhu', 'Guzheng', 'Pipa',
  ],
  '键盘': [
    'Grand Piano', 'Upright Piano', 'Electric Piano',
    'Rhodes', 'Wurlitzer', 'Synth', 'Analog Synth',
    'Modular Synth', 'Organ', 'Hammond Organ',
    'Harpsichord', 'Celesta', 'Accordion',
    'Mellotron', 'Clavinet', 'Keyboards',
  ],
  '打击': [
    'Acoustic Drums', 'Electronic Drums', 'Drum Machine',
    '808', '909', 'TR-808', 'TR-909', 'Percussion',
    'Brushed Drums', 'Timpani', 'Congas', 'Bongos',
    'Shaker', 'Tambourine', 'Hand Claps', 'Finger Snaps',
    'Cajon', 'Djembe', 'Tabla', 'Darbuka',
  ],
  '贝斯': [
    'Bass Guitar', 'Electric Bass', 'Fretless Bass',
    'Upright Bass', 'Synth Bass', '808 Sub Bass',
    'Moog Bass', 'Wobble Bass', 'Reese Bass',
    'Walking Bass', 'Slap Bass', 'Fingerstyle Bass',
    'Pick Bass', 'Sub Bass',
  ],
  '管乐': [
    'Saxophone', 'Alto Sax', 'Tenor Sax', 'Soprano Sax',
    'Trumpet', 'Trombone', 'French Horn', 'Tuba',
    'Flute', 'Clarinet', 'Oboe', 'Bassoon',
    'Recorder', 'Pan Flute', 'Shakuhachi', 'Duduk',
    'Harmonica', 'Bagpipes', 'Didgeridoo',
  ],
  '电子': [
    'Synthesizer', 'Analog Synth', 'Digital Synth',
    'Modular Synth', 'Arpeggiator', 'Sequencer',
    'Theremin', 'Ondes Martenot', 'Sampler',
    'Drum Machine', 'Groovebox', 'Synth Pad',
    'Synth Lead', 'Synth Bass', 'Supersaw',
    'Wavetable Synth', 'FM Synth',
  ],
};

// ═══════════════════════════════════════
//  16. BPM 参考表
// ═══════════════════════════════════════
export const BPM_REFERENCE = {
  'Largo':    [40, 60, '极慢，庄严'],
  'Adagio':   [60, 76, '慢板，从容'],
  'Andante':  [76, 108, '行板，步行速度'],
  'Moderato': [108, 120, '中板，适中'],
  'Allegro':  [120, 156, '快板，活泼'],
  'Vivace':   [156, 176, '快板，有活力'],
  'Presto':   [176, 200, '急板，非常快'],
  // 常见风格 BPM
  'Lo-Fi Hip Hop':     [70, 90],
  'Chillhop':          [70, 90],
  'Trip Hop':          [80, 100],
  'R&B':               [70, 100],
  'Hip Hop':           [80, 115],
  'Pop':               [100, 130],
  'Disco':             [110, 130],
  'House':             [120, 130],
  'Techno':            [125, 145],
  'Trance':            [125, 150],
  'Drum And Bass':     [160, 180],
  'Dubstep':           [140, 150],
  'Trap':              [130, 170],
  'Reggaeton':         [90, 100],
  'Bossa Nova':        [70, 90],
  'Waltz':             [84, 90],
  'Bebop':             [160, 250],
  'Blast Beat Metal':  [180, 250],
};

// ─── 便捷查询函数 ───

/**
 * 搜索风格关键词（模糊匹配）
 * @param {string} query - 搜索词
 * @returns {string[]} 匹配的风格列表
 */
export function searchStyle(query) {
  const q = query.toLowerCase();
  const allCategories = { ...ELECTRONIC, ...POP, ...ROCK, ...JAZZ, ...FOLK, ...HIPHOP, ...RNB, ...CLASSICAL, ...ASIAN, ...WORLD, ...AMBIENT, ...SPECIAL };
  const results = [];
  for (const [category, styles] of Object.entries(allCategories)) {
    for (const style of styles) {
      if (style.toLowerCase().includes(q)) {
        results.push({ category, style });
      }
    }
  }
  return results;
}

/**
 * 获取风格推荐（按 MBTI 维度）
 * @param {object} dimensions - { ei: 'E'|'I', sn: 'S'|'N', tf: 'T'|'F', jp: 'J'|'P' }
 * @returns {string[]} 推荐的风格关键词
 */
export function getStyleRecommendation(dimensions) {
  const { ei, sn, tf, jp } = dimensions;
  const recommendations = [];

  // E/I → 能量
  if (ei === 'E') recommendations.push('Energetic', 'Driving', 'Upbeat');
  if (ei === 'I') recommendations.push('Ambient', 'Intimate', 'Spacious');

  // S/N → 具体性
  if (sn === 'S') recommendations.push('Acoustic', 'Organic', 'Natural');
  if (sn === 'N') recommendations.push('Electronic', 'Synth', 'Experimental');

  // T/F → 情感
  if (tf === 'T') recommendations.push('Cool', 'Precise', 'Mechanical');
  if (tf === 'F') recommendations.push('Warm', 'Emotional', 'Melodic');

  // J/P → 结构
  if (jp === 'J') recommendations.push('Structured', 'Polished', 'Clean');
  if (jp === 'P') recommendations.push('Groovy', 'Laid-Back', 'Loose');

  return recommendations;
}
