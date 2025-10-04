import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 100 })
  email!: string;

  @Column({ name: "first_name", length: 50 })
  firstName!: string;

  @Column({ name: "last_name", length: 50 })
  lastName!: string;

  @Column({
    type: "enum",
    enum: ["admin", "client"],
    default: "client",
  })
  role!: "admin" | "client";

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "client";
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: "admin" | "client";
}

export interface UserResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "client";
  createdAt: Date;
  updatedAt: Date;
}
