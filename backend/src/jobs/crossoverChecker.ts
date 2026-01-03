import { processAllActiveRules, DetectedCrossover } from '../services/crossoverDetectionService';
import { notificationService } from '../services/notificationService';
import { notificationEmailService } from '../services/notificationEmailService';
import { getNotificationRule } from '../db/notificationDynamodb';

/**
 * Get user email from Cognito (placeholder - in production, this would query Cognito)
 * For now, we'll need to store email in the rule or preferences
 */
async function getUserEmail(userId: string): Promise<string | null> {
  // In a production environment, you would:
  // 1. Store user email in DynamoDB preferences
  // 2. Or query AWS Cognito AdminGetUser API
  // For now, return null to skip email sending
  console.log(`[CrossoverChecker] TODO: Implement getUserEmail for ${userId}`);
  return null;
}

/**
 * Process a single detected crossover
 */
async function processCrossover(detected: DetectedCrossover): Promise<void> {
  const { rule, crossover } = detected;

  try {
    // Create notification in database
    const notification = await notificationService.createFromCrossover(rule, crossover);

    console.log(
      `[CrossoverChecker] Created notification for ${crossover.coinSymbol} ` +
      `${crossover.type} (rule: ${rule.ruleId})`
    );

    // Send email if enabled
    if (rule.emailEnabled) {
      const userEmail = await getUserEmail(rule.userId);

      if (userEmail) {
        const emailSent = await notificationEmailService.sendCrossoverAlert(
          userEmail,
          rule.userId,
          notification,
          rule
        );

        if (emailSent) {
          console.log(
            `[CrossoverChecker] Sent email for ${crossover.coinSymbol} ` +
            `${crossover.type} to ${userEmail}`
          );
        }
      } else {
        console.log(
          `[CrossoverChecker] No email address for user ${rule.userId}, skipping email`
        );
      }
    }
  } catch (error) {
    console.error(
      `[CrossoverChecker] Error processing crossover for rule ${rule.ruleId}:`,
      error
    );
  }
}

/**
 * Run the crossover checker job
 */
export async function runCrossoverChecker(): Promise<void> {
  const startTime = Date.now();
  console.log('[CrossoverChecker] Starting crossover check...');

  try {
    // Process all active rules and detect crossovers
    const detectedCrossovers = await processAllActiveRules();

    console.log(
      `[CrossoverChecker] Detected ${detectedCrossovers.length} crossovers`
    );

    // Process each detected crossover
    for (const detected of detectedCrossovers) {
      await processCrossover(detected);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[CrossoverChecker] Completed in ${duration}ms. ` +
      `Processed ${detectedCrossovers.length} crossovers.`
    );
  } catch (error) {
    console.error('[CrossoverChecker] Job failed:', error);
    throw error;
  }
}

/**
 * Manual trigger endpoint for testing
 */
export async function triggerCrossoverCheck(): Promise<{
  success: boolean;
  crossoversDetected: number;
  duration: number;
}> {
  const startTime = Date.now();

  try {
    const detectedCrossovers = await processAllActiveRules();

    for (const detected of detectedCrossovers) {
      await processCrossover(detected);
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      crossoversDetected: detectedCrossovers.length,
      duration,
    };
  } catch (error) {
    console.error('[CrossoverChecker] Manual trigger failed:', error);
    return {
      success: false,
      crossoversDetected: 0,
      duration: Date.now() - startTime,
    };
  }
}
