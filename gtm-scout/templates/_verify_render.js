// One-off verification harness: simulates Loop 11 placeholder substitution + a minimal DOM,
// evaluates the template's embedded <script>, and checks the render functions run cleanly.
const fs = require('fs');
const path = require('path');

const tpl = fs.readFileSync(path.join(__dirname, 'gtm_report_template.html'), 'utf8');

// --- sample DATA (a realistic Loop 10 report_data.json) ---
const DATA = {
  metadata: {
    generated_at_display: 'Sunday, May 31, 2026 · 5:00 PM PT',
    brief_id: 'ai-stock-signals', cycle: 3, run_mode: 'warm',
    leaderboard_size: 3, sources_consulted: 26, evidence_records: 1077,
    passes_completed: 4, converged: true, data_availability: 'FULL',
    avg_score: 81, priority_count: 1, strong_count: 1, verified_pct: 73,
    changelog: [{ change_type: 'ADDED', name: 'The Plain Bagel', detail: 'new STRONG influencer' },
                { change_type: 'ADVERSARIAL_INVALIDATED', name: 'FakeStockGuru', detail: 'suspected bought followers' }]
  },
  brief: {
    product_name: 'AI Stock Signals',
    product_description: 'AI-powered stock-market signal platform for retail investors.',
    icp_summary: 'US retail traders & investors, 25-45, active on Reddit/YouTube finance.',
    budget_display: '$2,000 / month', objective_display: 'Acquire first 100 paying customers'
  },
  channel_type_meta: [
    { id: 'INFLUENCER', icon: '📣', label: 'Influencers' },
    { id: 'COMMUNITY', icon: '👥', label: 'Communities' },
    { id: 'NEWSLETTER', icon: '📰', label: 'Newsletters' }
  ],
  plan: {
    executive_summary: 'With $2k/mo and a goal of 100 paying customers, lead with free community plays and 2-3 micro-influencers in retail-investing YouTube, then layer a newsletter sponsor.',
    headline_recommendation: 'Run value-first AMAs in r/stocks while sponsoring 2 micro-influencers via affiliate codes.',
    top_moves: ['Apply to guest on a retail-investing podcast', 'Sponsor a 50k-subscriber finance newsletter', 'Negotiate affiliate-only deals with 3 micro creators'],
    budget_allocation: [
      { channel: 'Micro-influencers', amount_usd: 900, pct: 45, detail: '3 creators @ ~$300 verified rate', opportunity_ids: ['inf-the-plain-bagel'], cost_verified: true },
      { channel: 'Newsletter sponsor', amount_usd: 500, pct: 25, detail: 'one mid-size finance newsletter', opportunity_ids: ['news-stock-weekly'], cost_verified: false },
      { channel: 'Reserve', amount_usd: 600, pct: 30, detail: 'community + experiments', opportunity_ids: [], cost_verified: true }
    ],
    budget_total_usd: 2000, budget_period: 'monthly',
    outreach_strategy: [
      { step: 1, target_type: 'COMMUNITY', action: 'Post a value-first AMA in r/stocks', angle: 'Share a free backtest, no pitch', opportunity_ids: ['comm-r-stocks'], effort: 'EFFORT_LOW' },
      { step: 2, target_type: 'INFLUENCER', action: 'DM affiliate offer to The Plain Bagel', angle: 'AI vs human stock picks segment', opportunity_ids: ['inf-the-plain-bagel'], effort: 'EFFORT_MED' }
    ],
    content_strategy: [
      { channel: 'YouTube influencers', theme: 'AI vs human stock picks', formats: ['sponsored explainer', 'integration'], rationale: 'ties to ICP pain "I keep losing to the market".' }
    ],
    gtm_plan: {
      immediate: [{ action: 'Post AMA in r/stocks', opportunity_ids: ['comm-r-stocks'], conviction: 'HIGH', est_cost_usd: 0 }],
      short_term: [{ action: 'Sponsor 2 micro-influencers', opportunity_ids: ['inf-the-plain-bagel'], conviction: 'MEDIUM', est_cost_usd: 600 }],
      mid_term: [{ action: 'Launch affiliate program', opportunity_ids: [], conviction: 'MEDIUM' }],
      long_term: [{ action: 'Sponsor a retail-investing conference', opportunity_ids: ['event-traders-expo'], conviction: 'LOW' }]
    }
  },
  opportunities: [
    {
      rank: 1, opportunity_id: 'comm-r-stocks', name: 'r/stocks', type: 'COMMUNITY', platform: 'reddit',
      url: 'https://reddit.com/r/stocks', description: 'Large retail-investing subreddit.',
      opportunity_score: 91, core_score: 86, tier: 'PRIORITY',
      scores: { relevance: 95, audience_match: 92, reach: 88, growth_signals: 70, ease_of_access: 85, cost_efficiency: 95,
        relevance_rationale: 'Exactly the ICP.', audience_match_rationale: 'Retail investors.', reach_rationale: '7.5M members (verified via about page).',
        growth_signals_rationale: 'Steady activity.', ease_of_access_rationale: 'Public, allows quality posts; read rules.', cost_efficiency_rationale: 'Free channel.' },
      conviction: 'HIGH', convergence_count: 5,
      amplifiers_fired: ['explicit_icp_geo_match', 'multiple_reach_confirmations', 'promotion_allowed_or_partner_program', 'audience_growth_trend', 'published_reachable_contact'],
      suppressors_fired: [], effort: 'EFFORT_LOW', expected_roi: 'HIGH', est_cost_usd: 0, est_cost_verified: true,
      audience: { size: 7500000, size_unit: 'members', size_verified: true, influencer_tier: null, engagement_note: '~200 posts/day', icp_overlap_note: 'very high', geo_note: 'US-heavy' },
      access: { contact: 'modmail', contact_verified: true, accepts_sponsors: 'no', accepts_guests: 'unknown', promotion_allowed: 'with_partnership', partner_program_url: null, rate_card_note: 'n/a (organic)' },
      why_it_fits: 'The single largest concentration of the ICP, free to engage with value-first content.',
      outreach_angle: 'Share a transparent backtest thread, then an AMA. (suggested)',
      evidence: [{ kind: 'community', label: 'r/stocks — 7.5M members', url: 'https://reddit.com/r/stocks/about.json', source_tier: 3, date: '2026-05-20' }],
      risks: [{ risk: 'Strict self-promo rules — must lead with value.', severity: 'MEDIUM' }],
      adversarial: { passes: 3, latest_verdict: 'CONFIRMED', notes: 'Active, on-ICP, real.' },
      lifecycle_state: 'rising', outreach_status: 'none', score_trend: [{cycle:1,score:84},{cycle:2,score:88},{cycle:3,score:91}],
      independent_source_count: 4, data_availability: 'FULL', updated: 'May 31, 2026 · cycle 3'
    },
    {
      rank: 2, opportunity_id: 'inf-the-plain-bagel', name: 'The Plain Bagel', type: 'INFLUENCER', platform: 'youtube',
      url: 'https://youtube.com/@ThePlainBagel', description: 'Finance-education YouTube channel.',
      opportunity_score: 84, core_score: 81, tier: 'STRONG',
      scores: { relevance: 92, audience_match: 89, reach: 80, growth_signals: 74, ease_of_access: 78, cost_efficiency: 60,
        relevance_rationale: 'Retail investors; covered a peer in 2025.', audience_match_rationale: 'US 25-45 investing intent.', reach_rationale: '1.1M subs (verified).',
        growth_signals_rationale: '+8% subs (estimated).', ease_of_access_rationale: 'Business email published.', cost_efficiency_rationale: '~$3-5k/integration; above per-creator budget.' },
      conviction: 'HIGH', convergence_count: 6,
      amplifiers_fired: ['promoted_competitor_or_peer', 'sponsorship_or_guest_available', 'published_reachable_contact', 'explicit_icp_geo_match', 'multiple_reach_confirmations', 'promotion_allowed_or_partner_program'],
      suppressors_fired: [], effort: 'EFFORT_MED', expected_roi: 'MEDIUM', est_cost_usd: '3000-5000', est_cost_verified: true,
      audience: { size: 1100000, size_unit: 'subscribers', size_verified: true, influencer_tier: 'TIER_2', engagement_note: '~120k avg views', icp_overlap_note: 'high', geo_note: 'US-skewed' },
      access: { contact: 'business@example.com', contact_verified: true, accepts_sponsors: 'yes', accepts_guests: 'unknown', promotion_allowed: 'yes', partner_program_url: null, rate_card_note: '$3-5k/integration (media kit)' },
      why_it_fits: 'Trusted finance education reaching the ICP; already promotes peers.',
      outreach_angle: 'Offer an "AI vs human stock picks" segment with a tracked affiliate code. (suggested)',
      evidence: [{ kind: 'profile', label: 'YouTube — 1.1M subscribers', url: 'https://youtube.com/@ThePlainBagel/about', source_tier: 2, date: '2026-05-20' },
                 { kind: 'sponsorship', label: 'Media kit — integration rates', url: 'https://example.com/kit', source_tier: 5 }],
      risks: [{ risk: 'Integration cost exceeds per-creator budget.', severity: 'MEDIUM' },
              { risk: 'Growth is a third-party estimate.', severity: 'LOW', is_counter_evidence: true }],
      adversarial: { passes: 3, latest_verdict: 'CONFIRMED', notes: 'Audience real + on-ICP; only risk is cost.' },
      lifecycle_state: 'rising', outreach_status: 'none', score_trend: [{cycle:2,score:80},{cycle:3,score:84}],
      independent_source_count: 4, data_availability: 'FULL', updated: 'May 31, 2026 · cycle 3'
    },
    {
      rank: 3, opportunity_id: 'news-stock-weekly', name: 'Stock Weekly', type: 'NEWSLETTER', platform: 'beehiiv',
      url: 'https://stockweekly.example.com', description: 'Weekly retail-investing newsletter.',
      opportunity_score: 74, core_score: 76, tier: 'QUALIFIED',
      scores: { relevance: 88, audience_match: 82, reach: 55, growth_signals: 60, ease_of_access: 80, cost_efficiency: 70,
        relevance_rationale: 'Retail investors.', audience_match_rationale: 'Investing intent.', reach_rationale: 'Subscriber count unverified.',
        growth_signals_rationale: 'Unknown.', ease_of_access_rationale: 'Sponsor page exists.', cost_efficiency_rationale: 'CPM unverified.' },
      conviction: 'LOW', convergence_count: 2,
      amplifiers_fired: ['sponsorship_or_guest_available', 'explicit_icp_geo_match'],
      suppressors_fired: ['no_verifiable_reach'], effort: 'EFFORT_MED', expected_roi: 'MEDIUM', est_cost_usd: 'Unverified', est_cost_verified: false,
      audience: { size: null, size_unit: 'subscribers', size_verified: false, influencer_tier: null, engagement_note: 'Unverified', icp_overlap_note: 'medium', geo_note: 'unknown' },
      access: { contact: null, contact_verified: false, accepts_sponsors: 'yes', accepts_guests: 'unknown', promotion_allowed: 'yes', partner_program_url: 'https://stockweekly.example.com/sponsor', rate_card_note: 'Unverified' },
      why_it_fits: 'Topically aligned newsletter with an open sponsor page, but reach is unconfirmed.',
      outreach_angle: 'Ask for a media kit with verified subscriber count before committing spend. (suggested)',
      evidence: [{ kind: 'sponsorship', label: 'Sponsor page exists', url: 'https://stockweekly.example.com/sponsor', source_tier: 5 }],
      risks: [{ risk: 'Subscriber count and CPM unverified — do not allocate until confirmed.', severity: 'HIGH' }],
      adversarial: { passes: 2, latest_verdict: 'WEAKENED', notes: 'Reach unverifiable; capped at QUALIFIED.' },
      lifecycle_state: 'new', outreach_status: 'none', score_trend: [{cycle:3,score:74}],
      independent_source_count: 1, data_availability: 'PARTIAL', updated: 'May 31, 2026 · cycle 3'
    }
  ]
};

// --- Loop 11 placeholder substitution ---
let html = tpl
  .replace(/__GTM_DATA__/g, JSON.stringify(DATA))
  .replace(/__PRODUCT_NAME__/g, DATA.brief.product_name)
  .replace(/__GENERATED_AT__/g, DATA.metadata.generated_at_display)
  .replace(/__CYCLE__/g, String(DATA.metadata.cycle))
  .replace(/__RUN_MODE__/g, DATA.metadata.run_mode)
  .replace(/__CONVERGED__/g, DATA.metadata.converged ? 'CONVERGED' : 'IN PROGRESS')
  .replace(/__PASS_BADGE_CLASS__/g, DATA.metadata.converged ? 'badge-pass' : 'badge-progress')
  .replace(/__PASSES__/g, String(DATA.metadata.passes_completed));

// Confirm no placeholders remain
const leftover = html.match(/__[A-Z_]+__/g);
if (leftover) { console.error('PLACEHOLDERS REMAIN:', [...new Set(leftover)]); process.exit(1); }

// Extract the embedded script (the last <script>...</script>)
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('No <script> found'); process.exit(1); }
let script = m[1];

// --- minimal DOM stub for the methods the script uses ---
const store = {};
function mkEl() {
  return {
    _html: '', _text: '', style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
    set textContent(v){ this._text = v; }, get textContent(){ return this._text; },
    addEventListener(){}, querySelectorAll(){ return []; }, closest(){ return null; }, appendChild(){}
  };
}
const ids = ['hdrProduct','hdrCount','statTotal','statPriority','statStrong','statAvg','statVerified','statSources',
  'execWrap','tabRow','searchInput','sortSelect','filterBar','chipQuick','chipHighConv','chipHighRoi','content',
  'tab-budget','tab-outreach','tab-content','tab-plan','tab-opportunities','changelog','modalOverlay','modal'];
ids.forEach(id => store[id] = mkEl());
global.document = {
  getElementById(id){ return store[id] || (store[id] = mkEl()); },
  querySelectorAll(){ return []; },
  addEventListener(){},
  body: { style: {} }
};
global.window = global;

// Run it
try {
  new Function(script)();
} catch (e) {
  console.error('SCRIPT THREW:', e.message);
  console.error(e.stack);
  process.exit(1);
}

// Verify the render functions produced output
function check(name, cond) { console.log((cond ? 'OK  ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }
check('header product set', store['hdrProduct'] !== undefined);
check('statTotal rendered', store['statTotal']._text === 3 || store['statTotal']._text === '3');
check('exec summary rendered', /Executive Summary/.test(store['execWrap']._html));
check('opportunities content rendered', /r\/stocks/.test(store['content']._html) && /score-ring/.test(store['content']._html));
check('priority tier present', /PRIORITY|Priority/.test(store['content']._html));
check('unverified reach shown for newsletter', /Reach: Unverified/.test(store['content']._html));
check('budget panel rendered', /Budget Allocation/.test(store['tab-budget']._html));
check('budget unverified flagged', /Unverified cost/.test(store['tab-budget']._html));
check('outreach panel rendered', /Outreach Strategy/.test(store['tab-outreach']._html));
check('content panel rendered', /Content Strategy/.test(store['tab-content']._html));
check('gtm plan panel rendered', /Go-To-Market Plan/.test(store['tab-plan']._html) && /Immediate/.test(store['tab-plan']._html));
check('changelog rendered', /What changed/.test(store['changelog']._html));
check('all 6 dims in minibars', (store['content']._html.match(/mb-lab/g)||[]).length >= 18); // 6 dims * 3 cards
console.log('\nRender harness completed.');
