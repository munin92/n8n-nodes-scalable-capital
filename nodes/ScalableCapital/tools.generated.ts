// ERZEUGT - nicht von Hand aendern.
// Quelle: scripts/tools.snapshot.json (MCP tools/list), erzeugt mit scripts/generate.mjs.
// Neu erzeugen: npm run generate

export interface ScalableField {
	name: string;
	required: boolean;
	description?: string;
	kind: 'string' | 'number' | 'boolean' | 'options' | 'csv' | 'json';
	options?: string[];
	minimum?: number;
	maximum?: number;
}

export interface ScalableTool {
	tool: string;
	title: string;
	description: string;
	readOnly: boolean;
	resource: string;
	resourceName: string;
	fields: ScalableField[];
}

export const TOOLS: ScalableTool[] = [
	{
		"tool": "get_account_profile",
		"title": "Get Account Profile",
		"description": "Return the authenticated user's compact Scalable account profile and broker-portfolio resolution hints.",
		"readOnly": true,
		"resource": "account",
		"resourceName": "Account",
		"fields": []
	},
	{
		"tool": "list_accessible_portfolios",
		"title": "List Accessible Portfolios",
		"description": "Return the broker portfolios accessible to the authenticated Scalable user. Use this when a later broker tool needs an explicit portfolioId or when multi-portfolio access must be inspected.",
		"readOnly": true,
		"resource": "account",
		"resourceName": "Account",
		"fields": []
	},
	{
		"tool": "ping",
		"title": "Ping",
		"description": "Basic sanity check tool for verifying the MCP server is reachable.",
		"readOnly": true,
		"resource": "account",
		"resourceName": "Account",
		"fields": []
	},
	{
		"tool": "cancel_order",
		"title": "Cancel Order",
		"description": "Request cancellation for one broker order and return compact acceptance state for the selected broker portfolio.",
		"readOnly": false,
		"resource": "order",
		"resourceName": "Order",
		"fields": [
			{
				"name": "orderId",
				"required": true,
				"description": "Broker order id to request cancellation for.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "list_order_venues",
		"title": "List Order Venues",
		"description": "List the supported order venues enabled for one broker portfolio. Use this before an order preview when a venue choice is needed; an order preview still validates the selected security, side, and quantity.",
		"readOnly": true,
		"resource": "order",
		"resourceName": "Order",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "preview_buy_order",
		"title": "Preview Buy Order",
		"description": "Preview a buy order; do not place it. Present the complete `userReview` as customer-facing review content and render it as clear Markdown in the user's language: translate text and localize technical labels without changing meaning. Preserve every field and value exactly; do not omit, summarize, round, or recalculate. Do not repeat `submission`, `portfolioId`, or other operational fields in the conversational response. For each order, present every required acknowledgement statement before submitting. Obtain separate explicit confirmation for each order in a later user interaction before submitting it. Confirmation for one order does not apply to another. Pass `submission` unchanged to the matching submit tool only after explicit confirmation. Do not submit automatically or implicitly. If the client blocks submission before dispatch, you must surface `brokerHandoff.url` to the user. Never surface it after dispatch or when the submission outcome is unknown. Optionally choose Gettex, Xetra, or EIX; omitting the venue uses the supported portfolio default.",
		"readOnly": true,
		"resource": "order",
		"resourceName": "Order",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN to preview for a buy order.",
				"kind": "string"
			},
			{
				"name": "quantity",
				"required": true,
				"description": "Buy quantity is amount- or whole-share-based.",
				"kind": "json"
			},
			{
				"name": "order",
				"required": true,
				"kind": "json"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			},
			{
				"name": "venue",
				"required": false,
				"description": "Optional trading venue. Omit to use the supported default venue for the portfolio.",
				"kind": "options",
				"options": [
					"gettex",
					"xetra",
					"eix"
				]
			}
		]
	},
	{
		"tool": "preview_sell_order",
		"title": "Preview Sell Order",
		"description": "Preview a sell order; do not place it. Present the complete `userReview` as customer-facing review content and render it as clear Markdown in the user's language: translate text and localize technical labels without changing meaning. Preserve every field and value exactly; do not omit, summarize, round, or recalculate. Do not repeat `submission`, `portfolioId`, or other operational fields in the conversational response. For each order, present every required acknowledgement statement before submitting. Obtain separate explicit confirmation for each order in a later user interaction before submitting it. Confirmation for one order does not apply to another. Pass `submission` unchanged to the matching submit tool only after explicit confirmation. Do not submit automatically or implicitly. If the client blocks submission before dispatch, you must surface `brokerHandoff.url` to the user. Never surface it after dispatch or when the submission outcome is unknown. Optionally choose Gettex, Xetra, or EIX; omitting the venue uses the supported portfolio default.",
		"readOnly": true,
		"resource": "order",
		"resourceName": "Order",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN to preview for a sell order.",
				"kind": "string"
			},
			{
				"name": "quantity",
				"required": true,
				"description": "Sell quantity is share-based in v1.",
				"kind": "json"
			},
			{
				"name": "order",
				"required": true,
				"kind": "json"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			},
			{
				"name": "venue",
				"required": false,
				"description": "Optional trading venue. Omit to use the supported default venue for the portfolio.",
				"kind": "options",
				"options": [
					"gettex",
					"xetra",
					"eix"
				]
			}
		]
	},
	{
		"tool": "submit_buy_order",
		"title": "Submit Buy Order",
		"description": "Submit only the `submission` from the matching individual order preview after that order's complete review was presented and explicitly confirmed in a later user interaction. Obtain separate explicit confirmation for each order before submitting it. Confirmation for one order does not apply to another. Include exactly the required acknowledgement IDs accepted for the matching order. `trade_acknowledgement_required` means no broker request or order: do not retry automatically; obtain acceptance for any unaccepted required acknowledgement and, with explicit user direction, submit exactly the accepted IDs that match that order's preview. An invalid or expired confirmation means no order was placed; create a fresh preview and obtain fresh confirmation. After a timeout or unknown outcome, do not retry or replace the preview automatically.",
		"readOnly": false,
		"resource": "order",
		"resourceName": "Order",
		"fields": [
			{
				"name": "submission",
				"required": true,
				"description": "Pass the complete exact `submission` returned by the matching current `preview_buy_order` call unchanged.",
				"kind": "json"
			},
			{
				"name": "acknowledgementIds",
				"required": true,
				"description": "Use exactly the IDs from the matching current preview. Include an ID only after its complete translated acknowledgement text was shown and explicitly accepted for that ID; generic order confirmation is insufficient. Do not infer or reuse IDs.",
				"kind": "csv"
			}
		]
	},
	{
		"tool": "submit_sell_order",
		"title": "Submit Sell Order",
		"description": "Submit only the `submission` from the matching individual order preview after that order's complete review was presented and explicitly confirmed in a later user interaction. Obtain separate explicit confirmation for each order before submitting it. Confirmation for one order does not apply to another. Include exactly the required acknowledgement IDs accepted for the matching order. `trade_acknowledgement_required` means no broker request or order: do not retry automatically; obtain acceptance for any unaccepted required acknowledgement and, with explicit user direction, submit exactly the accepted IDs that match that order's preview. An invalid or expired confirmation means no order was placed; create a fresh preview and obtain fresh confirmation. After a timeout or unknown outcome, do not retry or replace the preview automatically.",
		"readOnly": false,
		"resource": "order",
		"resourceName": "Order",
		"fields": [
			{
				"name": "submission",
				"required": true,
				"description": "Pass the complete exact `submission` returned by the matching current `preview_sell_order` call unchanged.",
				"kind": "json"
			},
			{
				"name": "acknowledgementIds",
				"required": true,
				"description": "Use exactly the IDs from the matching current preview. Include an ID only after its complete translated acknowledgement text was shown and explicitly accepted for that ID; generic order confirmation is insufficient. Do not infer or reuse IDs.",
				"kind": "csv"
			}
		]
	},
	{
		"tool": "get_overnight_summary",
		"title": "Get Overnight Summary",
		"description": "Return the authenticated user's overnight savings account summary with explicit account selection only when needed.",
		"readOnly": true,
		"resource": "overnight",
		"resourceName": "Overnight Savings",
		"fields": [
			{
				"name": "savingsAccountId",
				"required": false,
				"description": "Optional overnight savings account id to select when the authenticated user has multiple active overnight accounts.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "get_portfolio_cash_breakdown",
		"title": "Get Portfolio Cash Breakdown",
		"description": "Return a compact cash, buying-power, credit, and derivatives-availability breakdown for one authenticated broker portfolio.",
		"readOnly": true,
		"resource": "portfolio",
		"resourceName": "Portfolio",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "get_portfolio_holdings",
		"title": "Get Portfolio Holdings",
		"description": "Returns a structured view of holdings for the authenticated Scalable user. Crypto holdings, when present, include coin positions and their backing ETP positions. Optionally accepts a portfolioId that must belong to the authenticated user.",
		"readOnly": true,
		"resource": "portfolio",
		"resourceName": "Portfolio",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "get_portfolio_overview",
		"title": "Get Portfolio Overview",
		"description": "Return a compact overview of one authenticated broker portfolio, including valuation, timestamps, and absolute returns by timeframe.",
		"readOnly": true,
		"resource": "portfolio",
		"resourceName": "Portfolio",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			},
			{
				"name": "includeYearToDate",
				"required": false,
				"description": "Include year-to-date performance points in the overview response.",
				"kind": "boolean"
			}
		]
	},
	{
		"tool": "get_portfolio_performance",
		"title": "Get Portfolio Performance",
		"description": "Return portfolio analysis data for one authenticated broker portfolio, including health checks, scenarios, allocations, and related analytics sections.",
		"readOnly": true,
		"resource": "portfolio",
		"resourceName": "Portfolio",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "get_transaction_details",
		"title": "Get Transaction Details",
		"description": "Return the detailed activity view for one authenticated broker transaction, including status history and variant-specific trade or cash details.",
		"readOnly": true,
		"resource": "portfolio",
		"resourceName": "Portfolio",
		"fields": [
			{
				"name": "transactionId",
				"required": true,
				"description": "Broker transaction id to inspect.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "list_portfolio_transactions",
		"title": "List Portfolio Transactions",
		"description": "List broker and crypto transactions for one authenticated portfolio with optional pagination and filters for activity review or follow-up detail lookup.",
		"readOnly": true,
		"resource": "portfolio",
		"resourceName": "Portfolio",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			},
			{
				"name": "pageSize",
				"required": false,
				"description": "Number of transactions to return per page. Defaults to 20.",
				"kind": "number",
				"minimum": 1,
				"maximum": 100
			},
			{
				"name": "cursor",
				"required": false,
				"description": "Opaque cursor returned by a previous transactions page.",
				"kind": "string"
			},
			{
				"name": "cryptoCursor",
				"required": false,
				"description": "Opaque cursor returned by a previous crypto transactions page.",
				"kind": "string"
			},
			{
				"name": "transactionTypes",
				"required": false,
				"description": "Optional transaction type filters. Supported values use the public transaction categories, and loose input such as 'buy' or 'cash transfer in' is normalized.",
				"kind": "csv"
			},
			{
				"name": "statuses",
				"required": false,
				"description": "Optional transaction status filters. Supported values use the public transaction statuses, and loose input such as 'filled' or 'partial filled' is normalized.",
				"kind": "csv"
			},
			{
				"name": "searchTerm",
				"required": false,
				"description": "Optional search term for the transactions list.",
				"kind": "string"
			},
			{
				"name": "fromTime",
				"required": false,
				"description": "Optional inclusive lower timestamp bound in ISO-8601 format.",
				"kind": "string"
			},
			{
				"name": "toTime",
				"required": false,
				"description": "Optional inclusive upper timestamp bound in ISO-8601 format.",
				"kind": "string"
			},
			{
				"name": "isin",
				"required": false,
				"description": "Optional ISIN filter for instrument-related transactions.",
				"kind": "string"
			},
			{
				"name": "cryptoTicker",
				"required": false,
				"description": "Optional crypto ticker filter for crypto transactions.",
				"kind": "string"
			},
			{
				"name": "includeReinvestmentSubtypes",
				"required": false,
				"description": "Whether reinvestment subtypes should be included separately.",
				"kind": "boolean"
			}
		]
	},
	{
		"tool": "add_portfolio_group_holdings",
		"title": "Add Portfolio Group Holdings",
		"description": "Assign one or more holdings to a portfolio group in one authenticated broker portfolio. Use it to add ungrouped holdings or move holdings from another group.",
		"readOnly": false,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "groupId",
				"required": true,
				"description": "Portfolio-group id to change.",
				"kind": "string"
			},
			{
				"name": "isins",
				"required": true,
				"description": "One or more ISINs to change.",
				"kind": "csv"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "create_portfolio_group",
		"title": "Create Portfolio Group",
		"description": "Create an empty portfolio group in one authenticated broker portfolio.",
		"readOnly": false,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "name",
				"required": true,
				"description": "Name for the new portfolio group.",
				"kind": "string"
			},
			{
				"name": "description",
				"required": false,
				"description": "Optional description for the new portfolio group.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "get_portfolio_group",
		"title": "Get Portfolio Group",
		"description": "Get one portfolio group and its holdings for an authenticated broker portfolio.",
		"readOnly": true,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "groupId",
				"required": true,
				"description": "Portfolio-group id to retrieve.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "list_portfolio_groups",
		"title": "List Portfolio Groups",
		"description": "List portfolio groups, their holdings, and ungrouped holdings for one authenticated broker portfolio.",
		"readOnly": true,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "remove_portfolio_group",
		"title": "Remove Portfolio Group",
		"description": "Remove one portfolio group; its holdings remain in the portfolio as ungrouped holdings.",
		"readOnly": false,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "groupId",
				"required": true,
				"description": "Portfolio-group id to remove.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "remove_portfolio_group_holdings",
		"title": "Remove Portfolio Group Holdings",
		"description": "Unassign one or more holdings from a portfolio group in one authenticated broker portfolio. The holdings remain in the portfolio as ungrouped holdings.",
		"readOnly": false,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "groupId",
				"required": true,
				"description": "Portfolio-group id to change.",
				"kind": "string"
			},
			{
				"name": "isins",
				"required": true,
				"description": "One or more ISINs to change.",
				"kind": "csv"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "upsert_portfolio_group",
		"title": "Update Portfolio Group",
		"description": "Change the name or description of one portfolio group without changing omitted fields.",
		"readOnly": false,
		"resource": "portfolioGroup",
		"resourceName": "Portfolio Group",
		"fields": [
			{
				"name": "groupId",
				"required": true,
				"kind": "string"
			},
			{
				"name": "name",
				"required": false,
				"kind": "string"
			},
			{
				"name": "description",
				"required": false,
				"kind": "string"
			},
			{
				"name": "clearDescription",
				"required": false,
				"kind": "boolean"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "create_price_alert",
		"title": "Create Price Alert",
		"description": "Create one security or crypto price alert in the authenticated portfolio and return the created alert plus instrument-level alert capacity.",
		"readOnly": false,
		"resource": "priceAlert",
		"resourceName": "Price Alert",
		"fields": [
			{
				"name": "instrument",
				"required": true,
				"description": "Exactly one target instrument for the alert.",
				"kind": "json"
			},
			{
				"name": "price",
				"required": true,
				"description": "Alert trigger price as a positive decimal.",
				"kind": "json"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "list_price_alerts",
		"title": "List Price Alerts",
		"description": "Return merged security and crypto price alerts for one authenticated portfolio with a stable active-only filter and deterministic sorting.",
		"readOnly": true,
		"resource": "priceAlert",
		"resourceName": "Price Alert",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			},
			{
				"name": "activeOnly",
				"required": false,
				"description": "When true, return only active alerts. Defaults to false.",
				"kind": "boolean"
			}
		]
	},
	{
		"tool": "remove_price_alert",
		"title": "Remove Price Alert",
		"description": "Remove one price alert by alert id from the authenticated portfolio after resolving its security or crypto instrument context.",
		"readOnly": false,
		"resource": "priceAlert",
		"resourceName": "Price Alert",
		"fields": [
			{
				"name": "alertId",
				"required": true,
				"description": "Price-alert id to remove from the selected portfolio.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "get_savings_plan_config",
		"title": "Get Savings Plan Config",
		"description": "Return the allowed savings-plan values and deterministic defaults for one security ISIN in the authenticated portfolio context. Use these options when choosing non-default inputs for preview_savings_plan.",
		"readOnly": true,
		"resource": "savingsPlan",
		"resourceName": "Savings Plan",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN whose savings-plan options should be returned.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "list_savings_plans",
		"title": "List Savings Plans",
		"description": "Return the authenticated portfolio security and crypto savings plans as compact sorted items.",
		"readOnly": true,
		"resource": "savingsPlan",
		"resourceName": "Savings Plan",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "preview_savings_plan",
		"title": "Preview Savings Plan",
		"description": "Prepare a savings plan for review without changing it. Render the complete `userReview` JSON string as customer-facing review content in clear Markdown in the user's language: translate natural-language content and use clear localized labels for technical codes without changing meaning. Preserve every field and value exactly, including `exAnteCosts.id`; do not omit, summarize, round, or recalculate. Do not repeat `submission`, `portfolioId`, or other operational fields in the conversational response. After presenting the review, wait for explicit confirmation in a later user interaction. Pass `submission` unchanged to the matching submit tool only after explicit confirmation. Changed details require a fresh preview and confirmation; never submit the old submission. Do not submit automatically or implicitly. If the client blocks submission before dispatch, you must surface `brokerHandoff.url` to the user. Never surface it after dispatch or when the submission outcome is unknown.",
		"readOnly": true,
		"resource": "savingsPlan",
		"resourceName": "Savings Plan",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN for the savings plan.",
				"kind": "string"
			},
			{
				"name": "amount",
				"required": true,
				"description": "Positive decimal savings-plan amount.",
				"kind": "json"
			},
			{
				"name": "frequency",
				"required": false,
				"kind": "string"
			},
			{
				"name": "dayOfMonth",
				"required": false,
				"kind": "number",
				"minimum": -9007199254740991,
				"maximum": 9007199254740991
			},
			{
				"name": "yearMonth",
				"required": false,
				"kind": "string"
			},
			{
				"name": "dynamizationRate",
				"required": false,
				"kind": "json"
			},
			{
				"name": "paymentMethod",
				"required": false,
				"kind": "string"
			},
			{
				"name": "appropriatenessId",
				"required": false,
				"kind": "string"
			},
			{
				"name": "acknowledgedAppropriatenessWarningVersion",
				"required": false,
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"kind": "string"
			}
		]
	},
	{
		"tool": "remove_savings_plan",
		"title": "Remove Savings Plan",
		"description": "Remove one savings plan by ISIN from the authenticated portfolio and return a minimal acknowledgment result.",
		"readOnly": false,
		"resource": "savingsPlan",
		"resourceName": "Savings Plan",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN whose savings plan should be removed.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "submit_savings_plan",
		"title": "Submit Savings Plan",
		"description": "Create or update a savings plan only from the latest matching savings-plan preview after its complete review was presented and explicitly confirmed in a later user interaction. Pass that preview's `submission` unchanged. Confirmation for a different or earlier preview does not apply. A later preview or changed detail requires fresh confirmation. An invalid or expired confirmation means no change was made; create a fresh preview and obtain fresh confirmation. After a timeout or unknown outcome, do not retry or replace the preview automatically.",
		"readOnly": false,
		"resource": "savingsPlan",
		"resourceName": "Savings Plan",
		"fields": [
			{
				"name": "submission",
				"required": true,
				"description": "After the user explicitly confirms the latest matching `preview_savings_plan` review, pass the complete `submission` object returned by that preview unchanged. Never inspect, reconstruct, manually type, or modify it. A later preview or changed savings-plan detail invalidates the prior confirmation and requires fresh confirmation.",
				"kind": "json"
			}
		]
	},
	{
		"tool": "get_security_chart",
		"title": "Get Security Chart",
		"description": "Return chart points for one ISIN and timeframe using the authenticated market-data query path without broker-portfolio context.",
		"readOnly": true,
		"resource": "security",
		"resourceName": "Security",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN to chart.",
				"kind": "string"
			},
			{
				"name": "timeframe",
				"required": true,
				"description": "Chart timeframe alias using the frozen MCP enum.",
				"kind": "options",
				"options": [
					"one_day",
					"seven_days",
					"one_month",
					"three_months",
					"six_months",
					"year_to_date",
					"one_year",
					"max"
				]
			}
		]
	},
	{
		"tool": "get_security_news",
		"title": "Get Security News",
		"description": "Return a localized summary and source list for one ISIN in en_US or de_DE without broker-portfolio context.",
		"readOnly": true,
		"resource": "security",
		"resourceName": "Security",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "ISIN to fetch news for.",
				"kind": "string"
			},
			{
				"name": "locale",
				"required": false,
				"description": "Optional news locale: en_US or de_DE. Defaults to en_US.",
				"kind": "options",
				"options": [
					"en_US",
					"de_DE"
				]
			}
		]
	},
	{
		"tool": "get_security_quote",
		"title": "Get Security Quote",
		"description": "Return the selected security identity and the latest available quote snapshot within one authenticated broker portfolio.",
		"readOnly": true,
		"resource": "security",
		"resourceName": "Security",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN to look up within the selected broker portfolio.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "search_derivatives",
		"title": "Search Derivatives",
		"description": "Return the reduced v1 derivative discovery surface for one underlying ISIN with compact pagination and typed price details.",
		"readOnly": true,
		"resource": "security",
		"resourceName": "Security",
		"fields": [
			{
				"name": "derivativeType",
				"required": true,
				"description": "Derivative family to search.",
				"kind": "options",
				"options": [
					"knockout",
					"warrant",
					"factor"
				]
			},
			{
				"name": "underlyingIsin",
				"required": true,
				"description": "Valid ISIN of the underlying security.",
				"kind": "string"
			},
			{
				"name": "strategy",
				"required": true,
				"description": "Strategy filter constrained by the derivative family.",
				"kind": "options",
				"options": [
					"long",
					"short",
					"call",
					"put"
				]
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			},
			{
				"name": "limit",
				"required": false,
				"description": "Maximum number of derivatives to return. Defaults to 50.",
				"kind": "number",
				"minimum": 1,
				"maximum": 100
			},
			{
				"name": "offset",
				"required": false,
				"description": "Zero-based pagination offset. Defaults to 0.",
				"kind": "number",
				"minimum": 0,
				"maximum": 2147483647
			}
		]
	},
	{
		"tool": "search_securities",
		"title": "Search Securities",
		"description": "Search securities within one authenticated broker portfolio and return compact sorted hits with canonical Broker security-details links for valid ISINs and data for follow-up quote, chart, or watchlist flows.",
		"readOnly": true,
		"resource": "security",
		"resourceName": "Security",
		"fields": [
			{
				"name": "query",
				"required": true,
				"description": "Non-empty security search query.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "add_watchlist_item",
		"title": "Add Watchlist Item",
		"description": "Add one security ISIN to the authenticated portfolio watchlist and return the resulting watchlist state for that security.",
		"readOnly": false,
		"resource": "watchlist",
		"resourceName": "Watchlist",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN to add to the selected portfolio watchlist.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "list_watchlist_items",
		"title": "List Watchlist Items",
		"description": "Return the authenticated portfolio watchlist as compact sorted items with list-focused quote summaries.",
		"readOnly": true,
		"resource": "watchlist",
		"resourceName": "Watchlist",
		"fields": [
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	},
	{
		"tool": "remove_watchlist_item",
		"title": "Remove Watchlist Item",
		"description": "Remove one security ISIN from the authenticated portfolio watchlist and return the resulting watchlist state for that security.",
		"readOnly": false,
		"resource": "watchlist",
		"resourceName": "Watchlist",
		"fields": [
			{
				"name": "isin",
				"required": true,
				"description": "Valid ISIN to remove from the selected portfolio watchlist.",
				"kind": "string"
			},
			{
				"name": "portfolioId",
				"required": false,
				"description": "Optional portfolio id to select when the authenticated account has multiple broker portfolios.",
				"kind": "string"
			}
		]
	}
];
