export interface MirroredDevice {
  id: number;
  name: string;
  maximum_consumption: number;
  assigned_user_id?: number;
  created_at?: Date;
}
