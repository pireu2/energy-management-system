import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../config/database";
import {
  Device,
  CreateDeviceRequest,
  UpdateDeviceRequest,
  DeviceResponse,
} from "./Device";

export class DeviceRepository {
  private repository: Repository<Device>;

  constructor() {
    this.repository = AppDataSource.getRepository(Device);
  }

  async findAll(): Promise<DeviceResponse[]> {
    const devices = await this.repository.find({
      relations: ["assignedUser"],
      order: { createdAt: "DESC" },
    });

    return devices.map((device) => this.mapToResponse(device));
  }

  async findById(id: number): Promise<DeviceResponse | null> {
    const device = await this.repository.findOne({
      where: { id },
      relations: ["assignedUser"],
    });

    return device ? this.mapToResponse(device) : null;
  }

  async findByUserId(userId: number): Promise<DeviceResponse[]> {
    const devices = await this.repository.find({
      where: { assignedUserId: userId },
      relations: ["assignedUser"],
      order: { createdAt: "DESC" },
    });

    return devices.map((device) => this.mapToResponse(device));
  }

  async findUnassigned(): Promise<DeviceResponse[]> {
    const devices = await this.repository.find({
      where: { assignedUserId: IsNull() },
      order: { createdAt: "DESC" },
    });

    return devices.map((device) => this.mapToResponse(device));
  }

  async create(deviceData: CreateDeviceRequest): Promise<DeviceResponse> {
    const device = this.repository.create(deviceData);
    const savedDevice = await this.repository.save(device);

    return (await this.findById(savedDevice.id)) as DeviceResponse;
  }

  async update(
    id: number,
    deviceData: UpdateDeviceRequest
  ): Promise<DeviceResponse | null> {
    await this.repository.update(id, deviceData);
    return await this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== null && (result.affected ?? 0) > 0;
  }

  async assignToUser(
    deviceId: number,
    userId: number
  ): Promise<DeviceResponse | null> {
    await this.repository.update(deviceId, { assignedUserId: userId });
    return await this.findById(deviceId);
  }

  async unassignFromUser(deviceId: number): Promise<DeviceResponse | null> {
    await this.repository.update(deviceId, { assignedUserId: null });
    return await this.findById(deviceId);
  }

  async unassignAllFromUser(userId: number): Promise<number> {
    const result = await this.repository.update(
      { assignedUserId: userId },
      { assignedUserId: null }
    );
    return result.affected ?? 0;
  }

  private mapToResponse(device: Device): DeviceResponse {
    return {
      id: device.id,
      name: device.name,
      description: device.description ?? undefined,
      maximumConsumption: Number(device.maximumConsumption),
      deviceType: device.deviceType,
      location: device.location ?? undefined,
      isActive: device.isActive,
      assignedUserId: device.assignedUserId ?? undefined,
      assignedUser: device.assignedUser
        ? {
            id: device.assignedUser.id,
            email: device.assignedUser.email,
          }
        : undefined,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}
