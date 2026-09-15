const RELEASE_NOTES = [
    {
        version: '2.5.3',
        date: '2026-09-15',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    'PC 端应用内自动更新：启动静默检查新版本，设置页可手动检查。',
                    '确认更新后自动下载安装包并校验完整性，静默安装后退出应用。'
                ]
            },
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '版本号统一升级至 v2.5.3；发版脚本自动生成 latest.json 更新元数据。'
                ]
            }
        ]
    },
    {
        version: '2.5.2',
        date: '2026-09-15',
        sections: [
            {
                title: '优化',
                tone: 'blue',
                items: [
                    'PC 自定义光标重构为品牌色圆环：空闲细环、悬停柔光放大、按下略缩，更轻更跟手。',
                    '移除四角取景框、空闲自转与语义图标，降低视觉噪音并减少每帧布局开销。',
                    '输入框与可编辑区域继续使用原生光标，禁用/加载态以透明度区分。'
                ]
            },
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '版本号统一升级至 v2.5.2，Android versionCode 递增至 20。'
                ]
            }
        ]
    },
    {
        version: '2.5.1',
        date: '2026-09-14',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    '目标计划项目支持多维排序：默认顺序、按名称、按创建时间、按更新时间、按进度、按存储大小。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '目标计划封面加载失败时自动回退为首字母渐变，避免裂图。',
                    'PC 端默认窗口尺寸调整为 1600×900。'
                ]
            },
            {
                title: '修复',
                tone: 'yellow',
                items: [
                    '目标计划封面清理时跳过 cover 子目录与封面文件，避免误删封面。'
                ]
            },
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '版本号统一升级至 v2.5.1，Android versionCode 递增至 19。'
                ]
            }
        ]
    },
    {
        version: '2.5.0',
        date: '2026-08-22',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    '新增目标计划清单模块，支持工程列表、父子任务层级与任务图片管理。',
                    '目标计划数据由后端统一存储，PC 与移动端可同步访问。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '打开更新记录弹窗即标记当前版本已读，底栏仅保留关闭按钮。'
                ]
            },
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '版本号统一升级至 v2.5.0，Android versionCode 递增至 18。'
                ]
            }
        ]
    },
    {
        version: '2.4.3',
        date: '2026-08-18',
        sections: [
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '版本号统一升级至 v2.4.3，并重新构建 PC NSIS 安装包。'
                ]
            }
        ]
    },
    {
        version: '2.4.2',
        date: '2026-07-19',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    'PC 提示词详情改为独立弹窗，可保留当前搜索、筛选和浏览位置。',
                    '详情弹窗支持双窗口对比阅读、最小化恢复及选中文字复制。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '优化详情内容层级、独立滚动与键盘操作，并适配减少动态效果偏好。',
                    '收紧新建和编辑提示词时的图片区空态，减少无效留白。'
                ]
            },
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '完成桌面端、Android、安装器与应用内版本信息同步。'
                ]
            }
        ]
    },
    {
        version: '2.4.1',
        date: '2026-07-18',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    '新增跨端主题切换能力，提示词编辑与管理操作更顺手。',
                    '优化图片下载流程、下载记录及移动端图片保存体验。',
                    '工作台新增暗色欢迎横幅与主题化视觉表现。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '优化跨端提示词管理界面与 PC 设置页布局层级。',
                    '统一应用与安装器默认字体，改善文字显示一致性。'
                ]
            },
            {
                title: '修复',
                tone: 'yellow',
                items: [
                    '修复 PC 侧栏收起状态下导航布局不稳定的问题。'
                ]
            },
            {
                title: '发布',
                tone: 'blue',
                items: [
                    '完成桌面端、Android、安装器与应用内版本信息同步。'
                ]
            }
        ]
    },
    {
        version: '2.4.0',
        date: '2026-07-15',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    '完整备份恢复支持还原 ZIP 备份中的图片资源，并展示图片恢复结果。',
                    '更新记录弹窗补充本次版本说明，可直接查看最新功能变化。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '优化 PC 提示词详情的多图封面切换与图片预览体验。',
                    '优化 PC 侧栏工具入口及 PC、移动端设置页的版本信息展示。',
                    '完善备份、存储、局域网同步和开发服务启动过程的状态反馈。'
                ]
            },
            {
                title: '修复',
                tone: 'yellow',
                items: [
                    '修复移动端提示词详情预览关闭或页面卸载后可能残留遮罩的问题。'
                ]
            }
        ]
    },
    {
        version: '2.3.7',
        date: '2026-07-14',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    '新增应用内更新记录入口，可随时查看本次版本的功能变更。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '统一主应用、桌面端和移动端的版本号读取与展示来源。',
                    '同步发布配置与应用页面中的版本元信息，方便核验当前运行版本。'
                ]
            }
        ]
    },
    {
        version: '2.3.6',
        date: '2026-05-25',
        sections: [
            {
                title: '优化',
                tone: 'blue',
                items: [
                    '提示词库从详情页返回后，会保留上次查看的页码、选中提示词和表格滚动位置。'
                ]
            },
            {
                title: '发布',
                tone: 'yellow',
                items: [
                    '完成桌面端与 Android 发布版本及安装器配置同步。'
                ]
            }
        ]
    }
];

export { RELEASE_NOTES };
