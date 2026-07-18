const RELEASE_NOTES = [
    {
        version: '2.4.1',
        date: '2026-07-18',
        sections: [
            {
                title: '新增',
                tone: 'pink',
                items: [
                    'PC 与移动端新增图片下载记录，可查看已保存图片及下载状态。',
                    'PC 设置页补充数据备份与导出入口，便于管理本地资料。'
                ]
            },
            {
                title: '优化',
                tone: 'blue',
                items: [
                    'PC 侧栏新增浅色与深色主题切换，并适配减少动态效果偏好。',
                    '完善图片下载的地址编码、失败提示和移动端相册保存反馈。'
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
