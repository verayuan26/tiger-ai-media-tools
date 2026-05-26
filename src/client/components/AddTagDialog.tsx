import { useState } from 'react';
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

export type AddTagFormData = {
  name: string;
  normalizedName: string;
  synonyms: string[];
};

type AddTagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AddTagFormData) => void | Promise<void>;
  submitting?: boolean;
};

export function AddTagDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting = false
}: AddTagDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [normalizedName, setNormalizedName] = useState('');
  const [synonymsText, setSynonymsText] = useState('');

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) return;

    const synonyms = synonymsText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    await onConfirm({
      name: name.trim(),
      normalizedName: normalizedName.trim() || name.trim(),
      synonyms
    });
    setName('');
    setNormalizedName('');
    setSynonymsText('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加标签</DialogTitle>
          <DialogDescription>创建新的标签用于素材分类</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">标签名称 *</Label>
            <Input
              id="tag-name"
              placeholder="例如：机械设备"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="normalized-name">标准化名称</Label>
            <Input
              id="normalized-name"
              placeholder="留空则使用标签名称"
              value={normalizedName}
              onChange={(event) => setNormalizedName(event.target.value)}
            />
            <p className="text-xs text-gray-500">
              用于合并相似标签，例如&quot;denim&quot;和&quot;牛仔布&quot;可以归为同一组
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="synonyms">同义词（可选）</Label>
            <Input
              id="synonyms"
              placeholder="用逗号分隔，例如：machinery, equipment"
              value={synonymsText}
              onChange={(event) => setSynonymsText(event.target.value)}
            />
            <p className="text-xs text-gray-500">输入该标签的其他表达方式，用英文逗号分隔</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || submitting}
            className="bg-[#4a6fa5] hover:bg-[#3d5a8a]"
          >
            {submitting ? '保存中…' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
