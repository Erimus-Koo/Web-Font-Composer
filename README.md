# Web Font Composer

用来组合各种不同的字体（各自应用于不同字符），以便于查看字体组合的效果，找出喜爱的字体组合。

## Usage

- **Fontface** @font-face 中的 font-family 字体名，`Optional` 。如果不为空，则`Local`和`Google`至少需要指定一个。`Text`可选。
- **Local** 本地字体名，逗号`,`分隔，中间如果有空格会自动补全引号。
- **Google** [Google Fonts](https://fonts.google.com/) 字体名，需要使用引用时的那个名称（将字体加入购物车时会看到，有可能不同于显示的名称）。
- **Weight** 字重的偏移值。例如：正数`1`为取大一号字，即当前组合内的500号其实调用的是600号。必须配合`Fontface`使用。
- **Text** 适用的字符范围，支持直接输入字符，或者输入Unicode范围。必须配合`Fontface`使用。
- 在左侧 **Options** 面板调整设置时，可以在右侧 **Code Preview** 面板看到自动生成的代码。或者在 **Font Preview** 面板看到效果。

## Recommand

1. **Emoji** 因为大字符集很有可能跟 emoji 表情符有交集，会导致 emoji 显示为其他字体，所以考虑把 Emoji 的优先级设为最高，范围是 `U+300-FFFF`。
2. **数字** 个人目前选择的是 <u>Barlow</u>。<u>Barlow</u> 原本配合<u>思源</u>是刚好的，但是 <u>Poppins</u> 在目标字重范围内较粗，所以 <u>Barlow</u> 加重一号。
3. **英文** 因为考虑的主要是中英混排的情况，<u>思源</u>自带的英文字体不太喜欢，所以单独先设置英文字体。主要的考量点是 <u>x-height</u> 高一点以配合中文，然后尽量选单层的 a/g 以接近汉语拼音和手写体的习惯。
4. **中文** 选用的是[思源黑体](https://github.com/adobe-fonts/source-han-sans/releases)的港版，在兼容了简化字的同时，有比较多兼顾了书法习惯和古字的细节。具体见：[思源黑体各地区字型比较](https://github.com/Erimus-Koo/Comparison-of-Source-Han-Sans)
