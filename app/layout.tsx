import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'画画接龙 · 和朋友一起画点离谱的',description:'创建房间，邀请朋友一起写句子、画画、猜词，最后揭晓你们的脑洞接龙。',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>}
