# Octopus 像素小屋

房间使用 Blender 场景，人物和罗小黑均使用 2D 像素精灵，形成 2.5D 的效果。芙莉莲属于《葬送的芙莉莲》，这里按用户提供的角色图和 RPG 像素画风参考制作同人角色，保留白发双马尾、绿眼、红耳坠、白金服饰与棕靴；双手空着。

## 人物像素精灵

- `../../public/sprites/frieren.png`：网页使用的透明 PNG 图集，320×320；4 行分别为正面、左侧、右侧、背面，每行 4 帧（站立、迈步 A、经过、迈步 B）。
- `sprites/frieren-source.png`：内置 imagegen 生成的原始图集，使用纯洋红背景便于构建时转为透明。
- `sprites/style-reference.jpg`：用户提供的 2D RPG 画风参考。
- `sprites/PROMPTS.md`：完整生成提示词及背景修正提示词，使用内置 imagegen，未使用 CLI/API 回退。
- `sprites/atlas.json`：帧大小、顺序与脚底基线约定。
- `../../scripts/sprites/prepare-frieren.mjs`：保留原稿，将色键转换为真正 alpha；统一缩放、按每行腰部定位，脚底对齐到每个 80×80 格的第 74 行。
- `frieren-reference.png`：用户原先提供的芙莉莲像素形象参考。
- `frieren-detail.png` 与 `../../scripts/blender/render_frieren_detail.py`：历史 3D 版本近景与渲染脚本，不用于当前网页；脚本检测到 2D 角色会说明原因并停止。

重新准备图集：

```sh
node scripts/sprites/prepare-frieren.mjs
```

网页 `person.ts` 创建始终朝向相机的 Sprite 平面画片，像素明暗直接来自图集，不使用人物身体网格或骨架。依据相机坐标中的移动方向选择四个朝向，按实际移动距离切换步态帧；停止、被家具阻挡或系统减少动态效果时显示站姿。打开内容时冻结人物，回到中央时恢复正面。使用最近邻采样、alpha 裁切与深度测试，家具可正确遮挡人物，透明区域不遮挡场景；脚下单独绘制接触阴影。配色只跟随顶栏的共享主题。

## 房间资源

- `octopus-room.blend`：房间、灯光与正交相机；Player 和 Cat 均为空的位置标记。
- `layout.json`：网页碰撞矩形、出生点、区域坐标；采用 Three.js Y 向上坐标。
- `../../public/models/octopus-room.glb`：约 0.51 MB 的网页房间模型，不包含原 3D 人物。
- `../../scripts/blender/build_pixel_room.py`：确定性生成脚本（Blender 4.5 LTS）。
- `../../scripts/blender/pack_glb_normals.py`：导出后使用 glTF 标准量化格式存储法线，顶点位置和位置标记数据保持原值。

重新生成房间：

```sh
blender --background --python scripts/blender/build_pixel_room.py
```

浏览器保留当前像素插画渲染：家具使用分层明暗与轮廓描边，画布通过最近邻方式放大。人物在家具材质转换之后加入场景，保留像素原稿的色块，避免再次被立体光照切碎。

## 房间布局与黑猫

- 左后角双面大窗、百叶帘、窗台植物；工作台有上下双屏、双音响、键盘、音频接口、咖啡和 PC。工作台进入文章。
- 左侧收藏柜朝向房间，陈列机甲、模型车、复古相机、唱片、书籍和收纳篮。
- 工作台、妙妙屋展柜、床从左到右沿后墙排成一条直线。展柜进入妙妙屋；陈列飞船、机甲、微缩房屋景观、掌机和杂志，配透明柜门与暖灯。
- 床头靠后墙，床面加宽 20%、加长 25%，保留绿色条纹被套和铁锈色盖毯；旁边展柜稍作收窄，为加大的床留出空间。书桌前不放椅子，桌前通道和中央地毯区域均可行走。

`cat.ts` 使用 2D 罗小黑图集，四方向闲逛、伸懒腰、舔爪和被摸时眯眼。人物和猫保持 0.74 单位的脚底间距；键盘移动、点击寻路、路径平滑、摸猫接近与重置位置均检查动态碰撞。小黑被挡住会停在原地，随机伸懒腰、舔爪或休息，持续受阻时切换动作，空间恢复后继续巡游。

场景不显示小黑的文字标签，直接点击其精灵会绕行到安全的侧面位置；靠近时按 E / Enter 或点击“蹲下摸摸小黑”开始约 3.4 秒的互动。人物使用单独的蹲下、伸手和轻抚动画图集，小黑停留并回应，头顶显示 12×11 网格的像素爱心；移动、点击地面或 Esc 可取消，内容面板和搜索也会结束互动并暂停场景。系统减少动态效果时使用静态蹲姿与回应帧。

人物与猫的精灵沿画片高度写入直立深度，保留屏幕上的像素画面，同时避免俯视镜头下画片向后斜入桌沿。此修正仍使用正常深度测试，家具继续正确遮挡角色；不是将人物强制画在所有家具之上。

灯光只读取顶栏提供的全局主题状态，场景不保存独立主题。

首页 `/?view=room`；传统文章列表 `/?view=list`。点击切换按钮时会保存本机偏好。
使用 WASD / 方向键移动，靠近区域时按 E / Enter 浏览；点击地面让人物行走，点击区域标签自动寻路并打开内容。手机提供方向按钮。

## 罗小黑与摸猫资产

- `../../public/sprites/luoxiaohei.png`：320×560 真透明图集；四方向行走、伸懒腰、舔爪和被摸回应，共 28 帧。外形以用户提供图为主：大头小身、黄绿耳内、巨大浅黄绿眼睛与黑色椭圆瞳孔、黑身长尾。
- `../../public/sprites/frieren-pet.png`：320×160，两种侧向的蹲下与抚摸动作，共 8 帧。
- `sprites/luoxiaohei-source.png`、`sprites/frieren-pet-source.png`：内置 imagegen 原稿；`sprites/luoxiaohei-reference.png` 为用户参考图。
- `../../scripts/sprites/prepare-companions.mjs`：识别每行透明间隔，转透明、统一缩放并对齐脚底，避免源图不均匀排版造成切帧。运行 `node scripts/sprites/prepare-companions.mjs` 可重建。
- `sprites/COMPANION-PROMPTS.md`：完整提示词、生成方式与形象资料链接。

资料：用户罗小黑参考图、[1905 电影网形象资料](https://www.1905.com/mdb/film/2242929/?fr=mdbypk_zp)、[罗小黑 CAT 官方微博](https://weibo.com/luoxiaohei)。罗小黑属于《罗小黑战记》，本项目按用户要求制作像素同人形象。
