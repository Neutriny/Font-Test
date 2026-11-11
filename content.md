# 字体测试样张

这是一份用来**挑选字体**与检查排印质量的样张：中文段落、西文段落、中西混排段落，再加上数字、字母、标点的集中比较。页面顶部可以实时调整字号与行高，方便在大字与正文尺寸下分别观察。

## 中文段落

中文正文的重点是**字面大小、重心、笔形与灰度**。同一段文字放在不同字体里，行距的疏密、字与字之间的气口、标点的位置都会有差别，这些差别在小字号下最明显，也最容易被忽略。我们常说的“版面透气”，其实来自**字面率**与**笔画粗细**之间的平衡：字面率大的字体看起来更大方，但在密排时容易粘成一团；笔画纤细的字体清爽，却在低分辨率屏幕上显得发虚。

阅读一段较长的中文（例如本段），注意观察**横竖笔画的粗细对比**、*撇捺的收笔方式*，以及“的、一、是、了”这些高频字的重心是否稳定。如果一行读下来*眼睛不断被某个字形绊住*，那这个字体在正文里大概需要更大的字号或更宽的字距来补救。

中文的斜体通常是**机器倾斜（synthetic oblique）**，并非真正的意大利体：*这段文字就是倾斜后的样子*，汉字只是被整体切变，撇捺的角度并没有重新设计。因此中文长段落不建议使用倾斜，短句或标题偶尔为之可以增加语气。

## 西文段落

A good text face should feel **calm at reading size** and *lively when enlarged*. Set a paragraph of running text and the details that matter start to show: the **x-height**, the aperture of *a*, *c*, *e*, *s*, the terminals of *f* and *t*, and the way the stems or serifs carry the line of reading.

Look at how the family handles ***bold italic combinations*** — many typefaces ship a beautiful roman and a mediocre italic, or a heavy weight with cramped counters. Check the rhythm of the lowercase too: HOVERCRAFT in all caps looks *louder and wider*, while lowercase keeps an even grey. The quick brown fox jumps over the lazy dog, then 0123456789 follow quietly.

Kerning pairs worth a glance: AV, AW, AY, LT, LY, Ta, Te, To, Vo, Wa, Yo, f), r., P, and the classic **“Type” vs “T ype”**.

## 中西混排段落

在中文里嵌入 Latin words、*English phrases* 甚至 **API 名称**（例如 `getBoundingClientRect`）时，最容易暴露问题的是**基线对齐**与**中西文的字面大小差**。如果西文字体的 x-height 偏大，正文里的英文会显得鼓胀；反过来，西文太小时，*mixed typesetting* 又会出现明显的“洞”。

试着读这一行：设计师在 Figma 里调整 **font-feature-settings** 之后，发现 `line-height: 1.9` 比 *1.75* 更容易读。数字也要一起看：2024 年第 3 季度，活跃用户 1,284,930 人，同比增长 **12.7%**，ARPU 为 $4.35。

括号与引号的混排同样重要：他说“*Just ship it*”之后就没再解释（见附录 A）。行内代码 `npm run build` 不应该把整行的节奏打断。

## 数字比较

先确认两件事：数字是否**等宽（tabular）**，以及**易混字符**能否区分。

| 对比项 | 示例 | 观察点 |
| :--- | :--- | :--- |
| 全数字 | `0123456789` | 数字宽度是否一致 |
| 等宽检验 | `1111111111`<br>`0000000000` | 上下两行应严格对齐 |
| 易混 | `1 l I \| 0 O o` | 竖线、圈形是否有区别 |
| 易混 | `6 9 8 3 5 S` | 圈口开合与转折 |
| 小数与千分位 | `1,234,567.89` | 逗号与句点的位置 |
| 欧陆写法 | `1.234.567,89` | 与上行的对照 |
| 小数点后 | `0.5 0.05 0.005 0.0005` | 小字的清晰度 |
| 分数与上标 | `1/2 ½ 3/4 ¾ 10² 10³` | ½ 与 ² 是否有字形 |
| 数学符号 | `1 + 1 = 2 ≠ 3 ≤ 4 ≥ 5 ± 0.1` | 符号粗细是否匹配 |
| 货币 | `¥ 1,200 / $ 1,200 / € 1,200 / £ 1,200` | 符号大小与位置 |
| 时间与日期 | `12:30:45 / 2024-05-01 / 05/01/2024` | 冒号与斜线 |
| 电话号码 | `+86 138 0013 8000` | 分组之后的节奏 |
| 中文数字 | `一二三四五六七八九十百千万亿` | 与阿拉伯数字混用 |

`1111111111` 与 `0000000000` 上下两行如果完全等宽，说明字体本身使用了等宽数字，或者可以通过 `font-variant-numeric: tabular-nums` 打开（页面顶部的“等宽数字”开关即可验证）。

## 西文字母比较

| 类别 | 样张 |
| :--- | :--- |
| 大写 | A B C D E F G H I J K L M N O P Q R S T U V W X Y Z |
| 小写 | a b c d e f g h i j k l m n o p q r s t u v w x y z |
| 全大写单词 | **TYPOGRAPHY** *SPECIMEN* |
| 易混小写 | `rn m cl d vv w ij` |
| 易混大写 | `I J L O Q G S B 8` |
| 相似结构 | a a **a** ／ g g **g** ／ t t **t** |
| 变音符号 | Café, naïve, résumé, Zürich, Malmö, São Paulo, Straße, Ærø |
| 连字 | ffi ffl fi fl ﬀ ﬁ ﬂ ﬃ ﬄ |
| 引号与撇号 | “double” ‘single’ don’t it’s 90’s |
| 重音字母 | à á â ã ä å ç è é ê ë ì í î ï ñ ò ó ô õ ö ø ù ú û ü ý ÿ |

## 标点符号比较

| 类别 | 样张 |
| :--- | :--- |
| 中文标点 | ，。、；：？！“”‘’（）《》〈〉【】〔〕——……·～ |
| 西文标点 | , . ; : ? ! " ' ( ) [ ] { } < > — – … & @ # % * |
| 引号嵌套 | 他说：“她只回了一句‘随你’。” |
| 中英混用引号 | 标题写作“*Design is not decoration*”更好。 |
| 括号紧邻 | 括号内的英文 (like this) 与中文（像这样）要各自对齐。 |
| 破折号长度 | 短横 - 连接号 – 破折号 — 中文破折号 —— |
| 省略号 | ... … ⋯ 中文省略号…… |
| 顿号与逗号 | 苹果、橘子、香蕉，都要。 |
| 数字中的标点 | `1,000.50` ／ `1.000,50` ／ `12:30` ／ `2024-05-01` ／ `3.14` |
| 数学与符号 | + − × ÷ ± ≈ ≠ ≤ ≥ ∞ § ¶ † ‡ • ° ™ © ® |

斜线与竖线单独看：`/` `\` `|` —— 注意倾斜方向、粗细与端点。

## 字重与倾斜

| 样式 | 中文 | 西文 |
| :--- | :--- | :--- |
| 常规 | 永和九年，岁在癸丑 | The quick brown fox |
| **粗体** | **永和九年，岁在癸丑** | **The quick brown fox** |
| *斜体* | *永和九年，岁在癸丑* | *The quick brown fox* |
| ***粗斜体*** | ***永和九年，岁在癸丑*** | ***The quick brown fox*** |

> 提示：中文粗体若为机器加粗（faux bold），笔画会糊在一起；中文斜体若为机器切变，撇捺角度不变。这两项是判断一款字体是否“完整”的重要线索。

## 字形覆盖

| 区块 | 样张 |
| :--- | :--- |
| 简体常用 | 的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处理府研 |
| 繁体对照 | 龍龙 體体 畫画 學学 國国 變变 邊边 聽听 藥药 醫医 書书 車车 門门 馬马 |
| 日文假名 | あいうえお かきくけこ さしすせそ たちつてと なにぬねの はひふへほ まみむめも やゆよ らりるれろ わをん アイウエオ カキクケコ サシスセソ タチツテト ナニヌネノ ハヒフヘホ マミムメモ ヤユヨ ラリルレロ ワヲン |
| 希腊字母 | α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω |
| 西里尔字母 | А Б В Г Д Е Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ы Э Ю Я |
| 符号装饰 | ← ↑ → ↓ ↔ ⇐ ⇒ ★ ☆ ✓ ✗ ● ○ ■ □ ▲ △ ◆ ◇ ※ § ¶ † ‡ ° ℃ ℉ € £ ¥ |

## 版心与行距

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. *Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.* **Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore** eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

中文的长段落用来检查行距是否均匀：行与行之间的灰色是否一致，段间距与行距的比例是否协调，段尾的孤字是否刺眼。把这一段与上面的西文段落放在一起看，可以判断中西文的**行高基准线**是否统一：*中文字面更高，西文字面更矮*，两者共用同一行距时，视觉重心容易偏向一边。

---
