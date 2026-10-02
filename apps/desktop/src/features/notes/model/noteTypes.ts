export interface SkribNote {
  id: string;
  target_process_name: string;
  target_title: string;
  rel_x: number;
  rel_y: number;
  width: number;
  height: number;
  text: string;
  color: 'yellow' | 'peach' | 'mint' | 'sky' | 'lavender' | 'rose' | 'aqua' | 'sand';
  collapsed: boolean;
  created_at: number;
  updated_at: number;
  archived_at?: number | null;
  deleted_at?: number | null;
}
