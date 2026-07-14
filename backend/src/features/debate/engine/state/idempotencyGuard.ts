/**
 * idempotencyGuard.ts — chống double-transition khi 2 event đến cùng tick.
 *
 * Vấn đề: trong code hiện tại (`debate.service.ts:triggerTransition`), nếu Host
 * click Skip 2 lần liên tiếp hoặc 2 Captain cùng click Start cùng tick, 2
 * setTimeout cascade sẽ chạy song song → DB bị ghi 2 lần, client nhận 2 event
 * transition → UX broken.
 *
 * Giải pháp: per-room Mutex. Mọi transition state machine đều đi qua
 * `withLock(roomId, async () => ...)`. Tick thứ 2 sẽ chờ tick thứ 1 xong,
 * rồi re-evaluate state và skip transition đã được thực hiện.
 *
 * Thread-safety: dùng Promise chain (Node.js single-threaded event loop), không
 * cần lock thực sự. Mỗi `withLock` xếp 1 promise vào chain — promise chain
 * được thực thi tuần tự trên event loop.
 */
export class TransitionMutex {
  /**
   * Mỗi roomId có 1 chain — promise thứ N trong chain chờ promise thứ N-1 settle.
   * Map<roomId, chainPromise>.
   */
  private chains = new Map<string, Promise<unknown>>();

  /**
   * Đếm số call hiện đang "active" (chưa cleanup) cho mỗi roomId.
   * Increment khi `withLock` được gọi, decrement khi fn done (resolve/reject).
   * `isLocked(roomId)` = (counter > 0).
   */
  private activeCount = new Map<string, number>();

  /**
   * Chạy `fn` trong khi giữ lock cho roomId. Nếu có call khác đang giữ lock,
   * call hiện tại sẽ chờ cho đến khi lock được giải phóng, RỒI MỚI thực thi.
   *
   * Cleanup: lock entry được xoá khi chain đã settled và không còn waiter.
   */
  async withLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(roomId) ?? Promise.resolve();
    let release!: () => void;
    const myTurn = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Chain mới = chờ prev xong rồi mới đến lượt mình.
    this.chains.set(roomId, prev.then(() => myTurn));

    // Tăng counter NGAY khi call bắt đầu (trước khi await prev).
    this.activeCount.set(roomId, (this.activeCount.get(roomId) ?? 0) + 1);

    try {
      // Chờ prev settle (nếu có call trước đó đang chạy).
      await prev;
      // Thực thi fn trong khi giữ lock.
      return await fn();
    } finally {
      release();
      // Giảm counter khi fn done (resolve hoặc reject).
      const newCount = (this.activeCount.get(roomId) ?? 1) - 1;
      if (newCount <= 0) {
        this.activeCount.delete(roomId);
        this.chains.delete(roomId);
      } else {
        this.activeCount.set(roomId, newCount);
      }
    }
  }

  /**
   * Kiểm tra roomId có đang bị lock không (cho test/debug).
   * Trả về true nếu có ít nhất 1 call đang chờ hoặc đang chạy fn.
   */
  isLocked(roomId: string): boolean {
    return (this.activeCount.get(roomId) ?? 0) > 0;
  }

  /**
   * Xoá tất cả lock (cho test cleanup).
   */
  clear(): void {
    this.chains.clear();
    this.activeCount.clear();
  }
}

/**
 * Singleton instance cho toàn bộ app.
 * Handler gọi mutex.withLock(roomId, transitionFn) để serialize transitions.
 */
export const globalTransitionMutex = new TransitionMutex();