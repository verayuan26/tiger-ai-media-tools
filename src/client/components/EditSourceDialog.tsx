import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!source) return;

    setName(source.name);
    setRootPath(source.rootPath);
    setIncrementalScanEnabled(source.incrementalScanEnabled);
  }, [source]);

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
            <Input
              id="edit-source-path"
              placeholder="/Users/example/Documents/media"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">修改路径后请确认目录仍可读，必要时重新扫描</p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-sm">监听文件变化</p>
              <p className="text-xs text-gray-600 mt-1">关闭后该来源在侧栏会显示为未监听</p>
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
            className="bg-[#4a6fa5] hover:bg-[#3d5a8a]"
          >
            {submitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
