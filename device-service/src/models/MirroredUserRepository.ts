import { Repository } from "typeorm";
import { AppDataSource } from "../config/database";
import {
  MirroredUser,
  CreateMirroredUserRequest,
  UpdateMirroredUserRequest,
} from "./MirroredUser";

export class MirroredUserRepository {
  private repository: Repository<MirroredUser>;

  constructor() {
    this.repository = AppDataSource.getRepository(MirroredUser);
  }

  async findAll(): Promise<MirroredUser[]> {
    return await this.repository.find({
      order: { id: "ASC" },
    });
  }

  async findById(id: number): Promise<MirroredUser | null> {
    return await this.repository.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<MirroredUser | null> {
    return await this.repository.findOneBy({ email });
  }

  async create(userData: CreateMirroredUserRequest): Promise<MirroredUser> {
    await this.repository.upsert(userData, ["id"]);
    return (await this.repository.findOneBy({ id: userData.id }))!;
  }

  async update(
    id: number,
    userData: UpdateMirroredUserRequest
  ): Promise<MirroredUser | null> {
    await this.repository.update(id, userData);
    return await this.repository.findOneBy({ id });
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async syncFromUserService(userServiceUser: any): Promise<MirroredUser> {
    const existingUser = await this.findById(userServiceUser.id);

    if (existingUser) {
      if (existingUser.email !== userServiceUser.email) {
        return (await this.update(userServiceUser.id, {
          email: userServiceUser.email,
        })) as MirroredUser;
      }
      return existingUser;
    } else {
      return await this.create({
        id: userServiceUser.id,
        email: userServiceUser.email,
      });
    }
  }
}
