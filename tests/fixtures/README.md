`feishu-langchain-whiteboard.jpg` 来自 [all-about-langchain](https://octopus-wiki.vercel.app/post/all-about-langchain) 中 Agents 章节的飞书画板下载接口，原始尺寸为 2560 × 2560。

画板测试使用这张原图，以及通过 sharp 旋转和增加边距生成的图片，验证不同内容比例、透明区域、完整边距和内容像素。

`feishu-langchain-code-caption.json` 保留同一篇文章中 Model 说明与代码块的真实内容，以及 2026-10-01 纯文本接口返回的对应片段。根节点的 children 仅保留这个片段，代码块语言为 Python，说明为“接受初始化的模型实例”。
