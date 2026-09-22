import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  console.log('🔄 Starting daily staking rewards accumulation...')

  try {
    // 1. Get all active staking positions
    const { data: positions, error } = await supabase
      .from('staking_positions')
      .select(`
        id,
        amount,
        pool_id,
        total_rewards,
        last_reward_calculation,
        pools:staking_pools(apy)
      `)
      .eq('status', 'active')
      .is('locked_until', '>', new Date().toISOString())

    if (error) {
      console.error('Error fetching positions:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!positions || positions.length === 0) {
      console.log('No active staking positions found.')
      return new Response(JSON.stringify({ message: 'No active positions' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let updatedCount = 0
    let totalRewardsDistributed = 0

    // 2. Calculate and update rewards for each position
    for (const position of positions) {
      const apy = position.pools?.apy || 0
      const dailyReward = (position.amount * apy / 100) / 365

      if (dailyReward === 0) continue

      // Check if we should update (24 hours since last calculation)
      const lastCalc = position.last_reward_calculation
      if (lastCalc) {
        const hoursSinceLastCalc = (Date.now() - new Date(lastCalc).getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastCalc < 23) {
          console.log(`⏳ Skipping position ${position.id} — last calc was ${hoursSinceLastCalc.toFixed(1)} hours ago`)
          continue
        }
      }

      // Update total_rewards
      const { error: updateError } = await supabase
        .from('staking_positions')
        .update({
          total_rewards: position.total_rewards + dailyReward,
          last_reward_calculation: new Date().toISOString()
        })
        .eq('id', position.id)

      if (updateError) {
        console.error(`Failed to update position ${position.id}:`, updateError)
      } else {
        updatedCount++
        totalRewardsDistributed += dailyReward
        console.log(`✅ Position ${position.id} updated with +${dailyReward.toFixed(6)}`)
      }
    }

    console.log(`✅ Rewards updated for ${updatedCount} positions. Total rewards distributed: ${totalRewardsDistributed.toFixed(6)}`)

    return new Response(JSON.stringify({
      message: `Rewards updated for ${updatedCount} positions`,
      updatedCount,
      totalRewardsDistributed: totalRewardsDistributed.toFixed(6)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
