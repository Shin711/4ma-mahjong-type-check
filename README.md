# 4-Player Mahjong Style Analyzer (English)

Unofficial English-friendly derivative of **[四麻スタイル分析（雀魂牌譜屋連動）](https://yurakuurame.github.io/4ma-majang-type-check/)** by [悠楽うらめ (yurakuurame)](https://github.com/yurakuurame).

Paste 12 [MajSoul Stats](https://amae-koromo.sapk.ch/) fields (Jade room recommended), and the tool projects them onto the same 2 PCA axes as the original, classifying **intensity** (Balanced → Extreme) and **playstyle type** (Late Counter, Closed Value, Iron Wall, Lead and Fold, Open Speed, All-In Fighter).

## Credits

- Original author: [悠楽うらめ](https://github.com/yurakuurame) — [original repo](https://github.com/yurakuurame/4ma-majang-type-check) / [live site](https://yurakuurame.github.io/4ma-majang-type-check/)
- Method explanation: [note.com article](https://note.com/yuraku_urame/n/nbaac115a06fb)
- Stats source: [MajSoul Stats (amae-koromo)](https://amae-koromo.sapk.ch/)

The PCA math (means, standard deviations, weights, and S/A cutoffs) is copied unchanged from the original `index.html`.

## License / status

The upstream repository has **no license** published (there is an open issue requesting one). This project is an **unofficial English-friendly derivative**, not a claim of original authorship. Use and redistribute at your own discretion with attribution to the original author.

## Live site

https://shin711.github.io/4ma-mahjong-type-check/

## Local use

Open `index.html` in a browser, or serve the folder with any static file server.
