export interface Epoch {
  readonly id: number;
  readonly startedAt: string;
  readonly endedAt?: string;
}

export interface EpochManager {
  readonly currentEpoch: number;
  readonly groupId: string;
  
  getCurrentEpoch(): Epoch;
  incrementEpoch(): Epoch;
  getEpochHistory(): ReadonlyArray<Epoch>;
}

export class SimpleEpochManager implements EpochManager {
  private epochs: Epoch[] = [];
  private _currentEpoch: number;
  
  constructor(
    public readonly groupId: string,
    initialEpoch: number = 1
  ) {
    this._currentEpoch = initialEpoch;
    this.epochs.push({
      id: initialEpoch,
      startedAt: new Date().toISOString(),
    });
  }
  
  get currentEpoch(): number {
    return this._currentEpoch;
  }
  
  getCurrentEpoch(): Epoch {
    const current = this.epochs.find(e => e.id === this._currentEpoch);
    if (!current) {
      throw new Error(`Current epoch ${this._currentEpoch} not found`);
    }
    return current;
  }
  
  incrementEpoch(): Epoch {
    // End the current epoch
    const currentIndex = this.epochs.findIndex(e => e.id === this._currentEpoch);
    if (currentIndex !== -1) {
      this.epochs[currentIndex] = {
        ...this.epochs[currentIndex],
        endedAt: new Date().toISOString(),
      };
    }
    
    // Create new epoch
    this._currentEpoch++;
    const newEpoch: Epoch = {
      id: this._currentEpoch,
      startedAt: new Date().toISOString(),
    };
    
    this.epochs.push(newEpoch);
    return newEpoch;
  }
  
  getEpochHistory(): ReadonlyArray<Epoch> {
    return [...this.epochs];
  }
}

// Factory function for creating epoch managers
export const createEpochManager = (
  groupId: string,
  initialEpoch?: number
): EpochManager => {
  return new SimpleEpochManager(groupId, initialEpoch);
};