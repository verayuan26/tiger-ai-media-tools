import { useState } from 'react';
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
import { Textarea } from './ui/textarea';

interface AddThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { name: string; description: string }) => void;
}

export function AddThemeDialog({ open, onOpenChange, onConfirm }: AddThemeDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (name) {
      onConfirm({ name, description });
      setName('');
      setDescription('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>新建主题</DialogTitle>
          <DialogDescription>
            创建新的主题集合来组织素材
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="theme-name">主题名称 *</Label>
            <Input
              id="theme-name"
              placeholder="例如：春季新品发布"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme-description">描述（可选）</Label>
            <Textarea
              id="theme-description"
              placeholder="简要描述该主题的用途和包含的素材类型"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!name} className="bg-[#4a6fa5] hover:bg-[#3d5a8a]">
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
