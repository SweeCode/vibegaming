import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const getWaveProgress = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const waves = await ctx.db
      .query('waveProgress')
      .withIndex('by_device_wave', q => q.eq('deviceId', deviceId))
      .collect()

    return waves.map(wave => ({
      waveNumber: wave.waveNumber,
      score: wave.score,
      completedAt: wave.completedAt,
      isBoss: wave.isBoss,
      bossType: wave.bossType
    }))
  }
})

export const completeWave = mutation({
  args: {
    deviceId: v.string(),
    waveNumber: v.number(),
    score: v.number(),
    isBoss: v.boolean(),
    bossType: v.optional(v.union(v.literal('sentinel'), v.literal('artillery')))
  },
  handler: async (ctx, args) => {
    // Check if wave is already completed
    const existing = await ctx.db
      .query('waveProgress')
      .withIndex('by_device_wave', q => 
        q.eq('deviceId', args.deviceId).eq('waveNumber', args.waveNumber)
      )
      .first()

    if (existing) {
      return { success: false, message: 'Wave already completed' }
    }

    // Complete the wave
    await ctx.db.insert('waveProgress', {
      deviceId: args.deviceId,
      waveNumber: args.waveNumber,
      score: args.score,
      completedAt: Date.now(),
      isBoss: args.isBoss,
      bossType: args.bossType,
      updatedAt: Date.now()
    })

    return { success: true, message: 'Wave completed successfully' }
  }
})

export const getTotalScore = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const waves = await ctx.db
      .query('waveProgress')
      .withIndex('by_device_wave', q => q.eq('deviceId', deviceId))
      .collect()

    const totalScore = waves.reduce((sum, wave) => sum + wave.score, 0)
    const completedWaves = waves.length
    const highestWave = waves.length > 0 ? Math.max(...waves.map(w => w.waveNumber)) : 0

    return {
      totalScore,
      completedWaves,
      highestWave,
      waveScores: waves.map(wave => ({
        waveNumber: wave.waveNumber,
        score: wave.score,
        completedAt: wave.completedAt,
        isBoss: wave.isBoss,
        bossType: wave.bossType
      }))
    }
  }
})

export const resetProgress = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const waves = await ctx.db
      .query('waveProgress')
      .withIndex('by_device_wave', q => q.eq('deviceId', deviceId))
      .collect()

    // Delete all wave progress for this device
    for (const wave of waves) {
      await ctx.db.delete(wave._id)
    }

    return { success: true, message: 'Progress reset successfully' }
  }
})