interface ReplicaInfo {
  id: number;
  messageCount: number;
  lastMessageTime: number;
  isHealthy: boolean;
}

export class LoadBalancer {
  private replicas: Map<number, ReplicaInfo> = new Map();
  private replicaCount: number;
  private currentReplica: number = 0;
  private strategy: "round-robin" | "least-loaded" | "consistent-hash";

  constructor(
    replicaCount: number,
    strategy: "round-robin" | "least-loaded" | "consistent-hash" = "round-robin"
  ) {
    this.replicaCount = replicaCount;
    this.strategy = strategy;

    for (let i = 1; i <= replicaCount; i++) {
      this.replicas.set(i, {
        id: i,
        messageCount: 0,
        lastMessageTime: Date.now(),
        isHealthy: true,
      });
    }
  }

  selectReplica(deviceId?: number): number {
    switch (this.strategy) {
      case "consistent-hash":
        return this.consistentHash(deviceId || 0);
      case "least-loaded":
        return this.leastLoaded();
      case "round-robin":
      default:
        return this.roundRobin();
    }
  }

  private roundRobin(): number {
    this.currentReplica = (this.currentReplica % this.replicaCount) + 1;

    const replica = this.replicas.get(this.currentReplica);
    if (replica && !replica.isHealthy) {
      for (let i = 1; i <= this.replicaCount; i++) {
        const nextReplica =
          ((this.currentReplica + i - 1) % this.replicaCount) + 1;
        const nextInfo = this.replicas.get(nextReplica);
        if (nextInfo && nextInfo.isHealthy) {
          this.currentReplica = nextReplica;
          break;
        }
      }
    }

    return this.currentReplica;
  }

  private leastLoaded(): number {
    let minLoad = Infinity;
    let selectedReplica = 1;

    this.replicas.forEach((info, id) => {
      if (info.isHealthy && info.messageCount < minLoad) {
        minLoad = info.messageCount;
        selectedReplica = id;
      }
    });

    return selectedReplica;
  }

  private consistentHash(deviceId: number): number {
    const hash = this.hashCode(deviceId.toString());
    return (Math.abs(hash) % this.replicaCount) + 1;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  recordMessage(replicaId: number): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.messageCount++;
      replica.lastMessageTime = Date.now();
    }
  }

  setReplicaHealth(replicaId: number, isHealthy: boolean): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.isHealthy = isHealthy;
    }
  }

  getStats(): { replicas: ReplicaInfo[]; totalMessages: number } {
    const replicaStats = Array.from(this.replicas.values());
    const totalMessages = replicaStats.reduce(
      (sum, r) => sum + r.messageCount,
      0
    );
    return { replicas: replicaStats, totalMessages };
  }

  resetStats(): void {
    this.replicas.forEach((replica) => {
      replica.messageCount = 0;
    });
  }
}
