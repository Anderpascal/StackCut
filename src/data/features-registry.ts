export interface RegistryFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'security' | 'integration' | 'analytics' | 'support';
  type: 'core' | 'infrastructure';
  isEnterpriseLocked: boolean;
  comparable: true;
}

export const featureRegistry = [
  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE FEATURES — Prerrequisitos enterprise, NO disparan redundancia
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'api_access',
    name: 'API Access',
    description: 'REST API with rate limits and documented endpoints',
    category: 'integration',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'integrations',
    name: 'Native Integrations',
    description: 'Pre-built third-party app connectors and webhooks',
    category: 'integration',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'saml_sso',
    name: 'SAML SSO',
    description: 'Single Sign-On via SAML 2.0 protocol for enterprise identity',
    category: 'security',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'audit_logs',
    name: 'Audit Logs',
    description: 'Comprehensive activity logging with export capabilities',
    category: 'security',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'sla',
    name: 'SLA Guarantee',
    description: '99.9%+ uptime commitment with financial service credits',
    category: 'support',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'priority_support',
    name: 'Priority Support',
    description: 'Dedicated support with <2h guaranteed response time',
    category: 'support',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'roles_permissions',
    name: 'Custom Roles & Permissions',
    description: 'Granular role-based access control with custom role creation',
    category: 'security',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },

  // ── Transversales genéricos (infraestructura funcional) ───────────────────

  {
    id: 'custom_fields',
    name: 'Custom Fields',
    description: 'User-defined data fields tailored to business workflows',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description: 'Multi-step automation logic with conditional branching',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'reporting',
    name: 'Reporting',
    description: 'Standard dashboards with pre-built report templates',
    category: 'analytics',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'dashboards',
    name: 'Dashboards',
    description: 'Drag-and-drop dashboard builder with real-time widget updates',
    category: 'analytics',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Predictive analytics, cohort analysis, and custom funnels',
    category: 'analytics',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'ai_features',
    name: 'AI Assistant',
    description: 'Generative AI capabilities for content generation and insights',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'white_label',
    name: 'White Labeling',
    description: 'Full brand customization—remove vendor logos, custom domains',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'file_sharing',
    name: 'File Sharing',
    description: 'Upload, share, and co-edit files within the platform',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'collaboration',
    name: 'Collaboration',
    description: 'Simultaneous multi-user editing with presence indicators and comments',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'recording',
    name: 'Recording',
    description: 'Cloud recording of meetings with transcription and searchable archive',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'video_hosting',
    name: 'Video Hosting',
    description: 'Native video upload and playback with adaptive streaming',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'knowledge_base',
    name: 'Knowledge Base',
    description: 'Self-service help center with searchable articles and categorization',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'ticketing',
    name: 'Ticketing',
    description: 'Multi-channel ticket creation with priority, assignment, and SLA tracking',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'email_automation',
    name: 'Email Automation',
    description: 'Automated email sequences, drip campaigns, and behavioral triggers',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'email_templates',
    name: 'Email Templates',
    description: 'Reusable branded email templates with dynamic merge tags',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'a_b_testing',
    name: 'A/B Testing',
    description: 'Split-test subject lines, content, and send times with statistical reporting',
    category: 'analytics',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'pipeline_mgmt',
    name: 'Pipeline Management',
    description: 'Visual sales pipeline with drag-and-drop stages and revenue forecasting',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'lead_scoring',
    name: 'Lead Scoring',
    description: 'Automated lead qualification based on behavioral and demographic rules',
    category: 'analytics',
    type: 'infrastructure',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'alerting',
    name: 'Alerting',
    description: 'Configurable alert rules with multi-channel delivery (email, SMS, webhook)',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'version_control',
    name: 'Version Control',
    description: 'Track document/code changes with diff view and rollback to any revision',
    category: 'core',
    type: 'infrastructure',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'real_time_messaging',
    name: 'Real-Time Messaging',
    description: 'Instant chat with threaded conversations and emoji reactions',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FEATURES — Ultra-específicos del dominio, SÍ disparan redundancia
  // ═══════════════════════════════════════════════════════════════════════════

  // ── CRM & Sales ──────────────────────────────────────────────────────────
  {
    id: 'crm_basic',
    name: 'CRM Core',
    description: 'Contact lifecycle, deal pipeline, and activity tracking',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'email_sequences',
    name: 'Email Sequences',
    description: 'Multi-step email outreach with cadence control and reply detection',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'voip_telephony',
    name: 'VoIP Telephony',
    description: 'Built-in cloud phone system with call recording and auto-logging',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Dev Tools ────────────────────────────────────────────────────────────
  {
    id: 'code_reviews',
    name: 'Code Reviews',
    description: 'Pull request-based code review with inline comments and approvals',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'ci_cd_pipelines',
    name: 'CI/CD Pipelines',
    description: 'Continuous integration and deployment with automated testing',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'serverless_deploy',
    name: 'Serverless Deploy',
    description: 'Zero-config deployment of serverless functions and static sites',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'preview_deployments',
    name: 'Preview Deployments',
    description: 'Automatic preview URLs for every git branch and pull request',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'edge_functions',
    name: 'Edge Functions',
    description: 'Serverless functions running at the edge with global low latency',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Video Conferencing ─────────────────────────────────────────────────
  {
    id: 'video_conferencing',
    name: 'Video Conferencing',
    description: 'HD video meetings with breakout rooms and virtual backgrounds',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'screen_sharing',
    name: 'Screen Sharing',
    description: 'Real-time screen sharing with annotation and remote control',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Async Video ────────────────────────────────────────────────────────
  {
    id: 'video_recording',
    name: 'Video Recording',
    description: 'One-click screen, camera, or both recording with instant sharing',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'async_video',
    name: 'Async Video',
    description: 'Non-real-time video messaging for distributed team communication',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Design ─────────────────────────────────────────────────────────────
  {
    id: 'design_prototyping',
    name: 'Design Prototyping',
    description: 'Interactive UI prototypes with transitions and micro-interactions',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'design_handoff',
    name: 'Design Handoff',
    description: 'Developer-ready specs with CSS, assets, and code snippets export',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'whiteboarding',
    name: 'Whiteboarding',
    description: 'Infinite canvas with sticky notes, smart frameworks, and real-time drawing',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Monitoring ─────────────────────────────────────────────────────────
  {
    id: 'infrastructure_monitoring',
    name: 'Infrastructure Monitoring',
    description: 'Host, container, and cloud service monitoring with 400+ integrations',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'apm',
    name: 'APM',
    description: 'Application Performance Monitoring with distributed tracing',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Email Marketing ─────────────────────────────────────────────────────
  {
    id: 'transactional_email',
    name: 'Transactional Email',
    description: 'API-first email delivery with template rendering and webhooks',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Customer Support ───────────────────────────────────────────────────
  {
    id: 'in_app_chat',
    name: 'In-App Chat',
    description: 'Embeddable live chat widget with proactive messaging triggers',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'chatbot_builder',
    name: 'Chatbot Builder',
    description: 'No-code conversational AI builder with intent training',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'shared_inbox',
    name: 'Shared Inbox',
    description: 'Collaborative email management with assignment and internal comments',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Communication ──────────────────────────────────────────────────────
  {
    id: 'email_collaboration',
    name: 'Email Collaboration',
    description: 'Real-time collaborative email drafting and thread management',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'channels',
    name: 'Channels',
    description: 'Topic-based messaging channels for organized group conversations',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'voice_channels',
    name: 'Voice Channels',
    description: 'Persistent voice channels for real-time audio communication',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Productivity & Wiki ────────────────────────────────────────────────
  {
    id: 'wiki_pages',
    name: 'Wiki Pages',
    description: 'Hierarchical documentation with nested pages and internal linking',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'real_time_co_editing',
    name: 'Real-Time Co-Editing',
    description: 'Simultaneous multi-user editing with cursor presence and comments',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'relational_database',
    name: 'Relational Database',
    description: 'Linked tables with foreign keys, lookups, and relational queries',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'database_views',
    name: 'Database Views',
    description: 'Grid, calendar, kanban, gallery, and Gantt views on relational data',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },

  // ── Project Management ─────────────────────────────────────────────────
  {
    id: 'project_timelines',
    name: 'Project Timelines',
    description: 'Visual timeline and roadmap planning with milestones and dependencies',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'gantt_charts',
    name: 'Gantt Charts',
    description: 'Bar-chart project scheduling with dependency lines and critical path',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: true,
    comparable: true,
  },
  {
    id: 'task_management',
    name: 'Task Management',
    description: 'Task creation, assignment, prioritization, and completion tracking',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'kanban_boards',
    name: 'Kanban Boards',
    description: 'Visual task management with swimlanes, WIP limits, and custom workflows',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: false,
    comparable: true,
  },
  {
    id: 'dependency_tracking',
    name: 'Dependency Tracking',
    description: 'Visualize and manage inter-task dependencies with critical path highlighting',
    category: 'core',
    type: 'core',
    isEnterpriseLocked: true,
    comparable: true,
  },

] as const satisfies RegistryFeature[];

// ── Array of feature IDs only (for validation convenience) ────────────────
export const featureRegistryIds: string[] = featureRegistry.map(f => f.id);

// ── Threshold constants for redundancy detection ──────────────────────────

/** Umbral de solapamiento para detectar redundancia (>60% del set menor de core features) */
export const REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6;

/** Mínimo absoluto de core features solapadas para considerar redundancia */
export const MIN_CORE_OVERLAP_FEATURES = 2;

// ── Helper: get all core features (objects) ───────────────────────────────
export function getCoreFeatures(): RegistryFeature[] {
  return featureRegistry.filter(f => f.type === 'core');
}

// ── Helper: get all infrastructure features (objects) ─────────────────────
export function getInfrastructureFeatures(): RegistryFeature[] {
  return featureRegistry.filter(f => f.type === 'infrastructure');
}

// ── Helper: get core feature IDs only ─────────────────────────────────────
export function getCoreFeatureIds(): string[] {
  return featureRegistry.filter(f => f.type === 'core').map(f => f.id);
}

// ── Helper: get infrastructure feature IDs only ───────────────────────────
export function getInfrastructureFeatureIds(): string[] {
  return featureRegistry.filter(f => f.type === 'infrastructure').map(f => f.id);
}

// ── Helper: check if a given feature ID is core ───────────────────────────
export function isCoreFeature(id: string): boolean {
  const feature = getFeatureById(id);
  return feature !== undefined && feature.type === 'core';
}

// ── Helper: check if a given feature ID is infrastructure ─────────────────
export function isInfrastructureFeature(id: string): boolean {
  const feature = getFeatureById(id);
  return feature !== undefined && feature.type === 'infrastructure';
}

// ── Helper: filter an array of featureIds to only core ────────────────────
export function filterCoreFeatures(featureIds: string[]): string[] {
  return featureIds.filter(id => isCoreFeature(id));
}

// ── Helper: filter an array of featureIds to only infrastructure ──────────
export function filterInfrastructureFeatures(featureIds: string[]): string[] {
  return featureIds.filter(id => isInfrastructureFeature(id));
}

// ── Existing helpers (unchanged signatures) ───────────────────────────────
export function getFeatureById(id: string): RegistryFeature | undefined {
  return featureRegistry.find(f => f.id === id);
}

export function getFeaturesByIds(ids: string[]): RegistryFeature[] {
  return ids.map(id => getFeatureById(id)).filter(Boolean) as RegistryFeature[];
}

export function validateFeatureIds(featureIds: string[]): string[] {
  const validIds: Set<string> = new Set(featureRegistry.map(f => f.id));
  const invalid = featureIds.filter(id => !validIds.has(id));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid feature IDs: ${invalid.join(', ')}. Must be from features-registry.`,
    );
  }
  return featureIds;
}
