import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { MirroredUser } from "./MirroredUser";

@Entity("devices")
export class Device {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({
    name: "description",
    type: "text",
    nullable: true,
  })
  description?: string;

  @Column({
    name: "maximum_consumption",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  maximumConsumption!: number;

  @Column({ name: "device_type", length: 50, default: "smart_meter" })
  deviceType!: string;

  @Column({
    name: "location",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  location?: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({
    name: "assigned_user_id",
    type: "int",
    nullable: true,
  })
  assignedUserId!: number | null;

  @ManyToOne(() => MirroredUser, (user) => user.devices)
  @JoinColumn({ name: "assigned_user_id" })
  assignedUser?: MirroredUser;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

export interface CreateDeviceRequest {
  name: string;
  description?: string;
  maximumConsumption: number;
  deviceType?: string;
  location?: string;
  assignedUserId?: number;
}

export interface UpdateDeviceRequest {
  name?: string;
  description?: string;
  maximumConsumption?: number;
  deviceType?: string;
  location?: string;
  assignedUserId?: number;
  isActive?: boolean;
}

export interface DeviceResponse {
  id: number;
  name: string;
  description: string | undefined;
  maximumConsumption: number;
  deviceType: string;
  location: string | undefined;
  isActive: boolean;
  assignedUserId: number | undefined;
  assignedUser:
    | {
        id: number;
        email: string;
      }
    | undefined;
  createdAt: Date;
  updatedAt: Date;
}
