import { useState } from 'react';
import { Folder } from 'lucide-react';
import { toast } from 'sonner';
import { defaultSourceNameFromPath, pickDirectoryFromSystem } from '../lib/pick-directory';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

type AddSourceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { name: string; path: string; isMonitoring: boolean }) => void | Promise<void>;
  submitting?: boolean;
};

export function AddSourceDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting = false
}: AddSourceDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [browsing, setBrowsing] = useState(false);

  async function handleBrowse(): Promise<void> {
    setBrowsing(true);
    try {
      const result = await pickDirectoryFromSystem();
      if (result.status === 'selected') {
        setPath(result.path);
        if (!name.trim()) {
          setName(defaultSourceNameFromPath(result.path));
        }
        return;
      }
      if (result.status === 'unavailable') {
        toast.message('无法打开系统目录选择器', {
          description: `${result.message}。请手动粘贴绝对路径。`
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法打开目录选择器';
      toast.error(message);
    } finally {
      setBrowsing(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!name.trim() || !path.trim()) return;

    await onConfirm({ name: name.trim(), path: path.trim(), isMonitoring });
    setName('');
    setPath('');
    setIsMonitoring(true);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加素材来源</DialogTitle>
          <DialogDescription>选择本地目录或外置硬盘作为素材来源</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="source-name">来源名称</Label>
            <Input
              id="source-name"
              placeholder="例如：工厂素材库"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-path">目录路径</Label>
            <div className="flex gap-2">
              <Input
                id="source-path"
                placeholder="/Users/example/Documents/media"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                disabled={submitting || browsing}
                onClick={() => void handleBrowse()}
              >
                <Folder className="size-4 mr-2" />
                {browsing ? '打开中…' : '浏览'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">点击浏览选择目录，或手动粘贴绝对路径</p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-sm">监听文件变化</p>
              <p className="text-xs text-muted-foreground mt-1">导入后可在后续版本启用增量扫描</p>
            </div>
            <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || !path.trim() || submitting}
          >
            {submitting ? '导入中…' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
