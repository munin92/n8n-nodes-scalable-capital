import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';

import { McpSession, type McpTool } from './McpTransport';

/**
 * Scalable's own CLI declares `forbid_automatic_phase_2_execution` for every
 * trade and savings-plan command. This node keeps that guarantee: unless the
 * user opts in, only tools the server itself marks read-only may run.
 */
function isReadOnly(tool: McpTool): boolean | undefined {
	const ann = (tool as { annotations?: Record<string, unknown> }).annotations;
	if (ann && typeof ann.readOnlyHint === 'boolean') return ann.readOnlyHint;
	if (ann && typeof ann.destructiveHint === 'boolean') return !ann.destructiveHint;
	return undefined;
}

const WRITE_HINT = /(^|[_.-])(buy|sell|cancel|trade|create|update|delete|add|remove|assign|unassign|set)([_.-]|$)/i;

export class ScalableCapital implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Scalable Capital',
		name: 'scalableCapital',
		icon: 'file:scalableCapital.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Read portfolio, market and transaction data from Scalable Capital via its official MCP endpoint',
		defaults: { name: 'Scalable Capital' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'scalableCapitalMcpApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Execute Tool',
						value: 'executeTool',
						description: 'Call one tool exposed by the Scalable Capital MCP server',
						action: 'Execute a tool',
					},
					{
						name: 'List Tools',
						value: 'listTools',
						description: 'Return the tool catalogue the server currently offers',
						action: 'List available tools',
					},
				],
				default: 'executeTool',
			},
			{
				displayName: 'Tool Name or ID',
				name: 'toolName',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTools' },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['executeTool'] } },
				description: 'Loaded live from the server, so a tool Scalable adds later shows up without a node update. Choose from the list or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Arguments',
				name: 'toolArguments',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['executeTool'] } },
				description: 'Arguments object passed to the tool, matching its input schema',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['executeTool'] } },
				options: [
					{
						displayName: 'Allow Write Operations',
						name: 'allowWrites',
						type: 'boolean',
						default: false,
						description:
							'Whether to permit tools that are not marked read-only. Scalable requires a separate human confirmation for trades and savings-plan changes and forbids running the confirmation step automatically — leave this off unless a human confirms each run.',
					},
					{
						displayName: 'Raw Response',
						name: 'raw',
						type: 'boolean',
						default: false,
						description: 'Whether to return the full MCP result instead of the parsed tool content',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { endpoint } = await this.getCredentials('scalableCapitalMcpApi');
				const session = new McpSession(this, endpoint as string);
				const tools = await session.listTools();
				return tools
					.map((tool) => ({
						name: tool.title ?? tool.name,
						value: tool.name,
						description: tool.description,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const { endpoint } = await this.getCredentials('scalableCapitalMcpApi');
		const session = new McpSession(this, endpoint as string);

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'listTools') {
					const tools = await session.listTools();
					out.push(
						...tools.map((tool) => ({
							json: { ...tool, readOnly: isReadOnly(tool) },
							pairedItem: { item: i },
						})),
					);
					continue;
				}

				const toolName = this.getNodeParameter('toolName', i) as string;
				const options = this.getNodeParameter('options', i, {}) as {
					allowWrites?: boolean;
					raw?: boolean;
				};

				if (!options.allowWrites) {
					const tool = (await session.listTools()).find((t) => t.name === toolName);
					const readOnly = tool ? isReadOnly(tool) : undefined;
					const blocked = readOnly === false || (readOnly === undefined && WRITE_HINT.test(toolName));
					if (blocked) {
						throw new NodeOperationError(
							this.getNode(),
							`"${toolName}" is not marked read-only. Scalable requires a separate human confirmation for trades and savings-plan changes. Enable "Allow Write Operations" only if a person confirms each run.`,
							{ itemIndex: i },
						);
					}
				}

				const rawArgs = this.getNodeParameter('toolArguments', i, '{}');
				const args =
					typeof rawArgs === 'string'
						? (JSON.parse(rawArgs || '{}') as Record<string, unknown>)
						: (rawArgs as Record<string, unknown>);

				const result = await session.callTool(toolName, args);

				if (options.raw) {
					out.push({ json: result as IDataObject, pairedItem: { item: i } });
					continue;
				}

				// Structured content is the useful shape when the server sends it;
				// otherwise fall back to the text blocks, parsed when they are JSON.
				const structured = (result as { structuredContent?: unknown }).structuredContent;
				if (structured !== undefined) {
					out.push({ json: structured as IDataObject, pairedItem: { item: i } });
					continue;
				}

				const content = ((result.content as Array<Record<string, unknown>>) ?? []).filter(
					(c) => c.type === 'text',
				);
				if (!content.length) {
					out.push({ json: result as IDataObject, pairedItem: { item: i } });
					continue;
				}
				for (const block of content) {
					const text = String(block.text ?? '');
					let json: IDataObject;
					try {
						const parsed = JSON.parse(text);
						json = typeof parsed === 'object' && parsed !== null ? (parsed as IDataObject) : { text };
					} catch {
						json = { text };
					}
					out.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [out];
	}
}
