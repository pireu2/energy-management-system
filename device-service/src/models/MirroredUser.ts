import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { Device } from "./Device";

@Entity("mirrored_users")
export class MirroredUser {
  @PrimaryColumn()
  id!: number;

  @Column({ unique: true, length: 100 })
  email!: string;

  @OneToMany(() => Device, (device) => device.assignedUser)
  devices!: Device[];
}

export interface CreateMirroredUserRequest {
  id: number;
  email: string;
}

export interface UpdateMirroredUserRequest {
  email?: string;
}
