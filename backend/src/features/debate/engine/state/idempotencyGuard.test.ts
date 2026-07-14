/**
 * Test cho TransitionMutex — đảm bảo serialize đồng thời cho cùng roomId,
 * song song cho khác roomId.
 */
import { describe, it, expect } from 'vitest';
import { TransitionMutex } from './idempotencyGuard';

describe('TransitionMutex', () => {
  it('chạy tuần tự cho cùng roomId (không parallel)', async () => {
    const mutex = new TransitionMutex();
    const order: number[] = [];

    const task = (id: number, delay: number) =>
      mutex.withLock('room-1', async () => {
        order.push(id);
        await new Promise((res) => setTimeout(res, delay));
        order.push(id + 100);
      });

    // Fire 3 task gần như đồng thời
    await Promise.all([task(1, 30), task(2, 10), task(3, 5)]);

    // Phải theo thứ tự 1→2→3 (mỗi task push id, chờ delay, push id+100)
    expect(order).toEqual([1, 101, 2, 102, 3, 103]);
  });

  it('chạy song song cho khác roomId', async () => {
    const mutex = new TransitionMutex();
    const order: string[] = [];

    const task = (room: string, delay: number) =>
      mutex.withLock(room, async () => {
        order.push(`${room}:start`);
        await new Promise((res) => setTimeout(res, delay));
        order.push(`${room}:end`);
      });

    // 2 task khác room — phải overlap
    await Promise.all([task('room-A', 30), task('room-B', 30)]);

    // Phải thấy cả 2 start trước khi thấy 1 end nào (parallel)
    const firstEnd = order.findIndex((s) => s.endsWith(':end'));
    const startsBeforeFirstEnd = order
      .slice(0, firstEnd)
      .filter((s) => s.endsWith(':start')).length;
    expect(startsBeforeFirstEnd).toBe(2);
  });

  it('cleanup lock sau khi chain settle', async () => {
    const mutex = new TransitionMutex();
    await mutex.withLock('room-x', async () => {
      expect(mutex.isLocked('room-x')).toBe(true);
    });
    // Cho microtask queue flush
    await new Promise((res) => setImmediate(res));
    expect(mutex.isLocked('room-x')).toBe(false);
  });

  it('giữ lock nếu fn throws — vẫn cleanup', async () => {
    const mutex = new TransitionMutex();
    await expect(
      mutex.withLock('room-y', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await new Promise((res) => setImmediate(res));
    expect(mutex.isLocked('room-y')).toBe(false);
  });

  it('chained calls tuần tự — call thứ 3 chờ call thứ 1 + 2', async () => {
    const mutex = new TransitionMutex();
    const log: string[] = [];

    const fire = (label: string, ms: number) =>
      mutex.withLock('room-z', async () => {
        log.push(`${label}:in`);
        await new Promise((res) => setTimeout(res, ms));
        log.push(`${label}:out`);
      });

    // Fire tuần tự bằng await — verify lock release đúng
    await fire('A', 10);
    await fire('B', 10);
    await fire('C', 10);

    expect(log).toEqual(['A:in', 'A:out', 'B:in', 'B:out', 'C:in', 'C:out']);
  });

  it('20 concurrent calls trên cùng roomId — không bị mất event nào', async () => {
    const mutex = new TransitionMutex();
    const completed: number[] = [];

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        mutex.withLock(`room-concurrent`, async () => {
          await new Promise((res) => setTimeout(res, Math.random() * 5));
          completed.push(i);
        }),
      ),
    );

    // Phải có đủ 20 call
    expect(completed).toHaveLength(20);
    // Mỗi id xuất hiện đúng 1 lần
    expect(new Set(completed).size).toBe(20);
  });
});