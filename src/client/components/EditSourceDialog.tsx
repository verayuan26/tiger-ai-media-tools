import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import { toast } from 'sonner';
import { pickDirectoryFromSystem } from '../lib/pick-directory';
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
import type { LibrarySourceStats } from '../../shared/types';

type EditSourceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: LibrarySourceStats | null;
  onConfirm: (data: {
    name: string;
    rootPath: string;
    incrementalScanEnabled: boolean;
  }) => void | Promise<void>;
  submitting?: boolean;
};

export function EditSourceDialog({
  open,
  onOpenChange,
  source,
  onConfirm,
  submitting = false
}: EditSourceDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [incrementalScanEnabled, setIncrementalScanEnabled] = useState(true);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    if (!source) return;

    setName(source.name);
    setRootPath(source.rootPath);
    setIncrementalScanEnabled(source.incrementalScanEnabled);
  }, [source]);

  async function handleBrowse(): Promise<void> {
    setBrowsing(true);
    try {
      const result = await pickDirectoryFromSystem();
      if (result.status === 'selected') {
        setRootPath(result.path);
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
    if (!name.trim() || !rootPath.trim()) return;

    await onConfirm({
      name: name.trim(),
      rootPath: rootPath.trim(),
      incrementalScanEnabled
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑素材来源</DialogTitle>
          <DialogDescription>修改来源名称、目录路径与增量扫描设置</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-source-name">来源名称</Label>
            <Input
              id="edit-source-name"
              placeholder="例如：工厂素材库"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-source-path">目录路径</Label>
            <div className="flex gap-2">
              <Input
                id="edit-source-path"
                placeholder="/Users/example/Documents/media"
                value={rootPath}
                onChange={(event) => setRootPath(event.target.value)}
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
            <p className="text-xs text-muted-foreground">点击浏览重新选择目录，或手动粘贴绝对路径</p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-sm">监听文件变化</p>
              <p className="text-xs text-muted-foreground mt-1">关闭后该来源在侧栏会显示为未监听</p>
            </div>
            <Switch checked={incrementalScanEnabled} onCheckedChange={setIncrementalScanEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || !rootPath.trim() || submitting}
          >
            {submitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
