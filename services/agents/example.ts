import { socialAgent } from './social-agent'

async function exampleUsage() {
  console.log('=== Social Media Agent Examples ===\n')

  console.log('1. Generate a single Instagram post about smart lighting')
  const postId1 = await socialAgent.createPostDraft(
    'instagram',
    ['smart lighting', 'home automation', 'smart home'],
    new Date(Date.now() + 24 * 60 * 60 * 1000),
    'smart lighting'
  )
  console.log(`Created post: ${postId1}`)

  console.log('\n2. Create approval task for the post')
  const taskId = await socialAgent.createApprovalTask(postId1)
  console.log(`Created task: ${taskId}`)

  console.log('\n3. Generate bulk posts (7 posts for the week)')
  const postIds = await socialAgent.generateBulkPosts(7)
  console.log(`Generated ${postIds.length} posts:`, postIds)

  console.log('\n4. Schedule weekly posts automatically')
  await socialAgent.scheduleWeeklyPosts()
  console.log('Weekly posts scheduled!')

  console.log('\n5. Get upcoming scheduled posts')
  const scheduled = await socialAgent.getScheduledPosts()
  console.log(`Found ${scheduled.length} posts scheduled for the next hour`)
  scheduled.forEach(post => {
    console.log(`  - ${post.platform}: ${post.content.substring(0, 50)}...`)
  })

  console.log('\n6. Approve a post and schedule it')
  await socialAgent.approvePost(
    postId1,
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  )
  console.log('Post approved and scheduled!')

  console.log('\n7. Search for specific products')
  const products = await socialAgent.searchProducts('sonos')
  console.log(`Found ${products.length} products:`, products.map(p => p.name))

  console.log('\n=== Examples completed ===')
}

if (require.main === module) {
  exampleUsage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error)
      process.exit(1)
    })
}

export { exampleUsage }
