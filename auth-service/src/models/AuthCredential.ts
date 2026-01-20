import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("auth_credentials")
export class AuthCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 100 })
  email!: string;

  @Column({ length: 255 })
  password!: string;

  @Column({
    name: "refresh_token",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  refreshToken!: string | null;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "client";
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
