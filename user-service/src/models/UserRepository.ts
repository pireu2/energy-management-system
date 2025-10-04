import { Repository } from "typeorm";
import { AppDataSource } from "../config/database";
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from "./User";

export class UserRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async findAll(): Promise<UserResponse[]> {
    return await this.repository.find({
      order: { createdAt: "DESC" },
    });
  }

  async findById(id: number): Promise<UserResponse | null> {
    return await this.repository.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<UserResponse | null> {
    return await this.repository.findOneBy({ email });
  }

  async create(userData: CreateUserRequest): Promise<UserResponse> {
    const user = this.repository.create(userData);
    return await this.repository.save(user);
  }

  async update(
    id: number,
    userData: UpdateUserRequest
  ): Promise<UserResponse | null> {
    await this.repository.update(id, userData);
    return await this.repository.findOneBy({ id });
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
