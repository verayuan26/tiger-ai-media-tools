import { Search, Filter, X } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  selectedFileTypes: string[];
  onToggleFileType: (type: string) => void;
  selectedLanguages: string[];
  onToggleLanguage: (language: string) => void;
}

const availableTags = [
  '缝纫机',
  '牛仔布',
  '裁剪布料',
  '熨烫面料',
  '产品册',
  '工人操作',
  '质量检查',
  '工厂车间',
];

const fileTypes = ['video', 'image', 'audio'];
const languages = ['中文', '英文', '俄文'];

export function FilterBar({
  searchQuery,
  onSearchChange,
  selectedTags,
  onToggleTag,
  selectedFileTypes,
  onToggleFileType,
  selectedLanguages,
  onToggleLanguage,
}: FilterBarProps) {
  const activeFiltersCount =
    selectedTags.length + selectedFileTypes.length + selectedLanguages.length;

  return (
    <div className="border-b p-4 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索文件名、标签、字幕内容..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="size-4 mr-2" />
              筛选
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>文件类型</DropdownMenuLabel>
            {fileTypes.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedFileTypes.includes(type)}
                onCheckedChange={() => onToggleFileType(type)}
              >
                {type === 'video' ? '视频' : type === 'image' ? '图片' : '音频'}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>语言</DropdownMenuLabel>
            {languages.map((lang) => (
              <DropdownMenuCheckboxItem
                key={lang}
                checked={selectedLanguages.includes(lang)}
                onCheckedChange={() => onToggleLanguage(lang)}
              >
                {lang}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuLabel>内容标签</DropdownMenuLabel>
            {availableTags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag}
                checked={selectedTags.includes(tag)}
                onCheckedChange={() => onToggleTag(tag)}
              >
                {tag}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedFileTypes.map((type) => (
            <Badge key={type} variant="secondary">
              {type === 'video' ? '视频' : type === 'image' ? '图片' : '音频'}
              <button
                onClick={() => onToggleFileType(type)}
                className="ml-1 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {selectedLanguages.map((lang) => (
            <Badge key={lang} variant="secondary">
              {lang}
              <button
                onClick={() => onToggleLanguage(lang)}
                className="ml-1 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
              <button
                onClick={() => onToggleTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
