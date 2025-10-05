import { Repository } from "typeorm";
import { AppDataSource } from "../config/database";
import { AuthCredential } from "./AuthCredential";
import bcrypt from "bcryptjs";

export class AuthRepository {
  private repository: Repository<AuthCredential>;

  constructor() {
    this.repository = AppDataSource.getRepository(AuthCredential);
  }

  async findByEmail(email: string): Promise<AuthCredential | null> {
    return await this.repository.findOneBy({ email });
  }

  async create(email: string, password: string): Promise<AuthCredential> {
    const hashedPassword = await bcrypt.hash(password, 12);
    const credential = this.repository.create({
      email,
      password: hashedPassword,
    });
    return await this.repository.save(credential);
  }

  async updateRefreshToken(email: string, refreshToken: string): Promise<void> {
    await this.repository.update({ email }, { refreshToken });
  }

  async validatePassword(
    credential: AuthCredential,
    password: string
  ): Promise<boolean> {
    return bcrypt.compare(password, credential.password);
  }

  async revokeRefreshToken(email: string): Promise<void> {
    await this.repository.update({ email }, { refreshToken: null });
  }

  async findByRefreshToken(
    refreshToken: string
  ): Promise<AuthCredential | null> {
    return await this.repository.findOneBy({ refreshToken });
  }
}
