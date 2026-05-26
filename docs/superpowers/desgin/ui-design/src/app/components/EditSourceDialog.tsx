import { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { LibrarySource } from '../types';

interface EditSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: LibrarySource | null;
  onConfirm: (data: { name: string; path: string; isMonitoring: boolean }) => void;
}

export function EditSourceDialog({ open, onOpenChange, source, onConfirm }: EditSourceDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    if (source) {
      setName(source.name);
      setPath(source.path);
      setIsMonitoring(source.isMonitoring);
    }
  }, [source]);

  const handleSubmit = () => {
    if (name && path) {
      onConfirm({ name, path, isMonitoring });
      onOpenChange(false);
    }
  };

  const handleBrowse = () => {
    // 实际实现中应该调用本地文件选择器
    const mockPath = '/Users/example/Documents/updated-source';
    setPath(mockPath);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑素材来源</DialogTitle>
          <DialogDescription>
            修改素材来源的名称和配置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-source-name">来源名称</Label>
            <Input
              id="edit-source-name"
              placeholder="例如：工厂素材库"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-source-path">目录路径</Label>
            <div className="flex gap-2">
              <Input
                id="edit-source-path"
                placeholder="/Users/example/Documents/media"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleBrowse}>
                <Folder className="size-4 mr-2" />
                浏览
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-sm">监听文件变化</p>
              <p className="text-xs text-gray-600 mt-1">
                自动检测新增和修改的文件
              </p>
            </div>
            <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !path} className="bg-[#4a6fa5] hover:bg-[#3d5a8a]">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
