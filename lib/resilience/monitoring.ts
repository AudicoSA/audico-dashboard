import { resilienceManager } from './resilience-manager'
import { CircuitState } from './circuit-breaker'

export interface AlertConfig {
  onCircuitOpen?: (serviceName: string) => void
  onCircuitClosed?: (serviceName: string) => void
  onHighErrorRate?: (serviceName: string, errorRate: number) => void
  onDegradation?: (serviceName: string) => void
}

class ResilienceMonitoring {
  private alertConfig: AlertConfig = {}
  private healthCheckInterval?: NodeJS.Timeout

  configure(config: AlertConfig): void {
    this.alertConfig = config
  }

  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkServiceHealth()
    }, intervalMs)

    this.setupStateListeners()
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  private setupStateListeners(): void {
    resilienceManager.onHealthChange((services) => {
      services.forEach(service => {
        if (service.state === CircuitState.OPEN && this.alertConfig.onCircuitOpen) {
          this.alertConfig.onCircuitOpen(service.name)
        }
        
        if (service.state === CircuitState.CLOSED && this.alertConfig.onCircuitClosed) {
          this.alertConfig.onCircuitClosed(service.name)
        }

        if (service.errorRate > 50 && this.alertConfig.onHighErrorRate) {
          this.alertConfig.onHighErrorRate(service.name, service.errorRate)
        }

        if (service.degradationActive && this.alertConfig.onDegradation) {
          this.alertConfig.onDegradation(service.name)
        }
      })
    })
  }

  private checkServiceHealth(): void {
    const services = resilienceManager.getAllServicesHealth()
    const unhealthyServices = services.filter(s => !s.healthy)

    if (unhealthyServices.length > 0) {
      console.warn(`⚠️  ${unhealthyServices.length} services are unhealthy:`, 
        unhealthyServices.map(s => s.name))
    }

    services.forEach(service => {
      const metrics = resilienceManager.getServiceMetrics(service.name)
      if (metrics && metrics.circuitBreakerTrips > 0) {
        console.info(`🔄 ${service.name} has tripped ${metrics.circuitBreakerTrips} times`)
      }
    })
  }

  async logToSupabase(supabase: any): Promise<void> {
    const services = resilienceManager.getAllServicesHealth()
    const metrics = resilienceManager.getAllMetrics()

    const records = services.map(service => {
      const serviceMetrics = metrics.find(m => m.serviceName === service.name)
      return {
        service_name: service.name,
        circuit_state: service.state,
        is_healthy: service.healthy,
        success_rate: service.successRate,
        error_rate: service.errorRate,
        recent_requests: service.recentRequests,
        degradation_active: service.degradationActive,
        total_requests: serviceMetrics?.requestsTotal || 0,
        failed_requests: serviceMetrics?.requestsFailed || 0,
        retries_total: serviceMetrics?.retriesTotal || 0,
        circuit_breaker_trips: serviceMetrics?.circuitBreakerTrips || 0,
        degradation_invocations: serviceMetrics?.degradationInvocations || 0,
        timestamp: new Date().toISOString()
      }
    })

    try {
      const { error } = await supabase
        .from('resilience_metrics')
        .insert(records)

      if (error) {
        console.error('Failed to log resilience metrics to Supabase:', error)
      }
    } catch (err) {
      console.error('Error logging resilience metrics:', err)
    }
  }

  getHealthSummary(): {
    overall: string
    services: { name: string; status: string; state: string }[]
    alerts: string[]
  } {
    const services = resilienceManager.getAllServicesHealth()
    const metrics = resilienceManager.getAllMetrics()

    const unhealthyCount = services.filter(s => !s.healthy).length
    const degradedCount = services.filter(s => s.degradationActive).length

    const overall = unhealthyCount === 0 
      ? 'Healthy' 
      : unhealthyCount === services.length 
        ? 'Critical'
        : 'Degraded'

    const serviceStatuses = services.map(service => ({
      name: service.name,
      status: service.healthy ? 'Healthy' : 'Unhealthy',
      state: service.state
    }))

    const alerts: string[] = []
    
    services.forEach(service => {
      if (service.state === CircuitState.OPEN) {
        alerts.push(`${service.name} circuit breaker is OPEN`)
      }
      if (service.errorRate > 50) {
        alerts.push(`${service.name} has high error rate: ${service.errorRate.toFixed(1)}%`)
      }
      if (service.degradationActive) {
        alerts.push(`${service.name} is running in degraded mode`)
      }
    })

    metrics.forEach(metric => {
      if (metric.circuitBreakerTrips > 5) {
        alerts.push(`${metric.serviceName} has tripped ${metric.circuitBreakerTrips} times`)
      }
    })

    return {
      overall,
      services: serviceStatuses,
      alerts
    }
  }
}

export const resilienceMonitoring = new ResilienceMonitoring()

export async function sendSlackAlert(serviceName: string, message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not configured')
    return
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *Resilience Alert*\n*Service:* ${serviceName}\n*Message:* ${message}`,
        username: 'Resilience Monitor',
        icon_emoji: ':shield:'
      })
    })
  } catch (error) {
    console.error('Failed to send Slack alert:', error)
  }
}

export async function sendEmailAlert(serviceName: string, message: string): Promise<void> {
  try {
    await fetch('/api/alerts/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `API Resilience Alert: ${serviceName}`,
        message: `Service: ${serviceName}\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`
      })
    })
  } catch (error) {
    console.error('Failed to send email alert:', error)
  }
}
