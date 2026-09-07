import {FolderOpen, Plus} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {Card, CardContent} from '../../../components/ui/card'

export function Welcome({onImport}) {
    return <main className="grid flex-1 place-items-center">
        <Card className="w-full max-w-lg"><CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-9 w-9 text-orange-300"/>
            <h1 className="mt-4 text-xl font-bold">导入漫画，开始写解说</h1>
            <p className="mt-2 text-sm text-slate-400">支持图片目录和 PDF 漫画；PDF 会自动按页展开。</p>
            <div className="mt-6 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => onImport('pdf')}>选择 PDF</Button>
                <Button onClick={() => onImport('directory')}><Plus className="h-4 w-4"/>选择漫画目录</Button>
            </div>
        </CardContent></Card>
    </main>
}
