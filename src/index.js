#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const { Command } = require('commander');

class HiveFlowMCPServer {
  constructor(config) {
    this.config = config;
    
    // Crear servidor MCP
    this.server = new Server({
      name: 'hiveflow-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    // Configurar cliente HTTP para HiveFlow
    this.hiveflowClient = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Authorization': `ApiKey ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.setupHandlers();
  }

  setupHandlers() {
    // Registrar herramientas disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_flow',
            description: 'Crea un nuevo flujo de trabajo en HiveFlow',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Nombre del flujo'
                },
                description: {
                  type: 'string',
                  description: 'Descripción del flujo'
                },
                nodes: {
                  type: 'array',
                  description: 'Nodos del flujo (opcional)',
                  items: { type: 'object' }
                }
              },
              required: ['name', 'description']
            }
          },
          {
            name: 'list_flows',
            description: 'Lista todos los flujos de trabajo del usuario',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['active', 'paused', 'stopped', 'draft'],
                  description: 'Filtrar por estado del flujo (opcional)'
                },
                limit: {
                  type: 'number',
                  description: 'Límite de resultados (opcional)',
                  default: 50
                }
              }
            }
          },
          {
            name: 'get_flow',
            description: 'Obtiene detalles de un flujo específico',
            inputSchema: {
              type: 'object',
              properties: {
                flowId: {
                  type: 'string',
                  description: 'ID del flujo'
                }
              },
              required: ['flowId']
            }
          },
          {
            name: 'execute_flow',
            description: 'Ejecuta un flujo de trabajo específico',
            inputSchema: {
              type: 'object',
              properties: {
                flowId: {
                  type: 'string',
                  description: 'ID del flujo a ejecutar'
                },
                inputs: {
                  type: 'object',
                  description: 'Inputs opcionales para el flujo'
                }
              },
              required: ['flowId']
            }
          },
          {
            name: 'pause_flow',
            description: 'Pausa un flujo activo',
            inputSchema: {
              type: 'object',
              properties: {
                flowId: {
                  type: 'string',
                  description: 'ID del flujo a pausar'
                }
              },
              required: ['flowId']
            }
          },
          {
            name: 'resume_flow',
            description: 'Reanuda un flujo pausado',
            inputSchema: {
              type: 'object',
              properties: {
                flowId: {
                  type: 'string',
                  description: 'ID del flujo a reanudar'
                }
              },
              required: ['flowId']
            }
          },
          {
            name: 'list_mcp_servers',
            description: 'Lista los servidores MCP configurados en HiveFlow',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'create_mcp_server',
            description: 'Registra un nuevo servidor MCP en HiveFlow',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Nombre único del servidor MCP'
                },
                command: {
                  type: 'string',
                  description: 'Comando para ejecutar el servidor'
                },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Argumentos del comando'
                },
                description: {
                  type: 'string',
                  description: 'Descripción del servidor'
                }
              },
              required: ['name', 'command']
            }
          },
          {
            name: 'get_flow_executions',
            description: 'Obtiene el historial de ejecuciones de un flujo',
            inputSchema: {
              type: 'object',
              properties: {
                flowId: {
                  type: 'string',
                  description: 'ID del flujo'
                },
                limit: {
                  type: 'number',
                  description: 'Límite de resultados',
                  default: 10
                }
              },
              required: ['flowId']
            }
          },
          {
            name: 'blurb_set_emotion',
            description: 'Muestra una emoción en Blurb, la mascota física de HiveFlow (pantalla RP2350). Requiere el blurb-bridge local o la placa por USB.',
            inputSchema: {
              type: 'object',
              properties: {
                emotion: {
                  type: 'string',
                  description: 'Una de: normal, happy, glee, excited, proud, love, shy, sad, crying, worried, scared, frustrated, annoyed, angry, furious, disgusted, unimpressed, bored, tired, sleepy, sleeping, closed, focused, determined, suspicious, skeptic, squint, curious, confused, thinking, surprised, awe, mischievous, embarrassed, dizzy, dead'
                },
                ms: {
                  type: 'number',
                  description: 'Duración en milisegundos (por defecto 3000)'
                }
              },
              required: ['emotion']
            }
          },
          {
            name: 'blurb_set_state',
            description: 'Cambia el estado base de Blurb (la mascota física): idle, running, thinking, listening, speaking, success, error, offline, low-credits, paused, loading, saving, waiting, not-found, crashed.',
            inputSchema: {
              type: 'object',
              properties: {
                state: { type: 'string', description: 'Estado de HiveFlow a reflejar' }
              },
              required: ['state']
            }
          },
          {
            name: 'blurb_status',
            description: 'Estado del blurb-bridge y de la placa de Blurb (firmware, estado actual, últimos eventos de touch/movimiento).',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      };
    });

    // Implementar ejecución de herramientas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_flow':
            return await this.createFlow(args);
          case 'list_flows':
            return await this.listFlows(args);
          case 'get_flow':
            return await this.getFlow(args);
          case 'execute_flow':
            return await this.executeFlow(args);
          case 'pause_flow':
            return await this.pauseFlow(args);
          case 'resume_flow':
            return await this.resumeFlow(args);
          case 'list_mcp_servers':
            return await this.listMCPServers();
          case 'create_mcp_server':
            return await this.createMCPServer(args);
          case 'get_flow_executions':
            return await this.getFlowExecutions(args);
          case 'blurb_set_emotion':
            return await this.blurbSend('/emotion', { v: args.emotion, ms: args.ms }, { t: 'emotion', v: args.emotion, ms: args.ms || 3000 });
          case 'blurb_set_state':
            return await this.blurbSend('/state', { v: args.state }, { t: 'state', v: args.state });
          case 'blurb_status':
            return await this.blurbStatus();
          default:
            throw new Error(`Herramienta desconocida: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error ejecutando ${name}: ${error.response?.data?.error || error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Registrar recursos disponibles
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'hiveflow://flows',
            name: 'HiveFlow Flows',
            description: 'List of all workflow flows',
            mimeType: 'application/json'
          },
          {
            uri: 'hiveflow://mcp-servers',
            name: 'MCP Servers',
            description: 'List of configured MCP servers',
            mimeType: 'application/json'
          },
          {
            uri: 'hiveflow://executions',
            name: 'Flow Executions',
            description: 'Flow execution history',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Registrar templates de recursos
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return {
        resourceTemplates: [
          {
            uriTemplate: 'hiveflow://flows/{flowId}',
            name: 'Specific Flow',
            description: 'Get details of a specific flow by its ID',
            mimeType: 'application/json'
          },
          {
            uriTemplate: 'hiveflow://flows/{flowId}/executions',
            name: 'Flow Executions',
            description: 'Get execution history of a specific flow',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Implementar lectura de recursos
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        console.error(`🔍 [DEBUG] Solicitando recurso: ${uri}`);

      // Función de emergencia que SIEMPRE devuelve algo válido
      const emergencyResponse = (errorMsg = 'Error desconocido') => {
        return {
          contents: [
            {
              uri: uri || 'unknown',
              mimeType: 'application/json',
              text: JSON.stringify({
                error: errorMsg,
                timestamp: new Date().toISOString(),
                uri: uri
              }, null, 2)
            }
          ]
        };
      };

      // Función helper para asegurar que siempre devolvemos un resultado válido
      const createValidResponse = (data, errorMsg = null) => {
        console.error(`🔍 [DEBUG] createValidResponse llamada con:`, {
          hasData: !!data,
          dataType: typeof data,
          errorMsg: errorMsg,
          uri: uri
        });
        
        let text;
        try {
          if (errorMsg) {
            text = JSON.stringify({
              error: errorMsg,
              uri: uri,
              timestamp: new Date().toISOString(),
              data: data || null
            }, null, 2);
          } else {
            text = JSON.stringify(data || [], null, 2);
          }
          
          console.error(`🔍 [DEBUG] JSON.stringify resultado:`, {
            textType: typeof text,
            textLength: text?.length,
            textPreview: text?.substring(0, 100)
          });
          
        } catch (jsonError) {
          console.error(`🔍 [DEBUG] Error en JSON.stringify:`, jsonError);
          text = JSON.stringify({
            error: 'Error al serializar datos: ' + jsonError.message,
            uri: uri,
            timestamp: new Date().toISOString()
          }, null, 2);
        }
        
        // Asegurar que text nunca sea undefined o null
        if (typeof text !== 'string' || text.length === 0) {
          console.error(`🔍 [DEBUG] Text inválido, usando fallback`);
          text = JSON.stringify({
            error: 'Respuesta vacía',
            uri: uri,
            timestamp: new Date().toISOString()
          }, null, 2);
        }
        
        const result = {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: text
            }
          ]
        };
        
        console.error(`🔍 [DEBUG] Respuesta final creada:`, {
          hasContents: !!result.contents,
          contentsLength: result.contents?.length,
          hasFirstContent: !!result.contents?.[0],
          hasText: !!result.contents?.[0]?.text,
          textLength: result.contents?.[0]?.text?.length,
          textType: typeof result.contents?.[0]?.text,
          uri: result.contents?.[0]?.uri,
          mimeType: result.contents?.[0]?.mimeType
        });
        
        // Validación final antes de devolver
        if (!result.contents || !result.contents[0] || typeof result.contents[0].text !== 'string') {
          console.error(`🔍 [DEBUG] ERROR: Resultado inválido detectado!`, result);
          // En lugar de lanzar error, crear un resultado de emergencia válido
          return {
            contents: [
              {
                uri: uri || 'unknown',
                mimeType: 'application/json',
                text: JSON.stringify({
                  error: 'Error interno: no se pudo generar respuesta válida',
                  timestamp: new Date().toISOString(),
                  debug: 'createValidResponse falló en validación final'
                }, null, 2)
              }
            ]
          };
        }
        
        return result;
      };

      try {
        switch (uri) {
          case 'hiveflow://flows':
            console.error(`🔍 [DEBUG] Obteniendo flujos de: ${this.hiveflowClient.defaults.baseURL}/api/flows`);
            try {
              const flowsResponse = await this.hiveflowClient.get('/api/flows');
              console.error(`🔍 [DEBUG] Respuesta flujos:`, {
                status: flowsResponse.status,
                hasData: !!flowsResponse.data,
                dataKeys: flowsResponse.data ? Object.keys(flowsResponse.data) : [],
                success: flowsResponse.data?.success,
                dataLength: flowsResponse.data?.data?.length
              });
              
              // Verificar que la respuesta sea exitosa y tenga datos
              if (flowsResponse.data && flowsResponse.data.success) {
                const flows = flowsResponse.data.data || [];
                return createValidResponse(flows);
              } else {
                return createValidResponse([], 'No se pudieron obtener los flujos: ' + (flowsResponse.data?.message || 'Error desconocido'));
              }
            } catch (apiError) {
              console.error(`🔍 [DEBUG] Error de API en flujos:`, {
                message: apiError.message,
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                code: apiError.code
              });
              
              let errorMessage = 'Error de conexión con el backend';
              if (apiError.code === 'ECONNREFUSED') {
                errorMessage = 'Backend no disponible en ' + this.hiveflowClient.defaults.baseURL + '. Asegúrate de que esté corriendo.';
              } else if (apiError.response?.data?.message) {
                errorMessage = apiError.response.data.message;
              }
              
              return createValidResponse([], errorMessage);
            }

          case 'hiveflow://mcp-servers':
            console.error(`🔍 [DEBUG] Obteniendo servidores MCP...`);
            try {
              const serversResponse = await this.hiveflowClient.get('/api/mcp/servers');
              if (serversResponse.data && serversResponse.data.success) {
                const servers = serversResponse.data.servers || [];
                return createValidResponse(servers);
              } else {
                return createValidResponse([], 'No se pudieron obtener los servidores MCP: ' + (serversResponse.data?.message || 'Error desconocido'));
              }
            } catch (apiError) {
              let errorMessage = 'Error de conexión con el backend';
              if (apiError.code === 'ECONNREFUSED') {
                errorMessage = 'Backend no disponible. Asegúrate de que esté corriendo en ' + this.hiveflowClient.defaults.baseURL;
              }
              return createValidResponse([], errorMessage);
            }

          case 'hiveflow://executions':
            console.error(`🔍 [DEBUG] Obteniendo ejecuciones...`);
            try {
              // Primero obtener todos los flujos
              const flowsResponse = await this.hiveflowClient.get('/api/flows');
              if (flowsResponse.data && flowsResponse.data.success) {
                const flows = flowsResponse.data.data || [];
                let allExecutions = [];
                
                // Para cada flujo, obtener sus procesos/ejecuciones
                for (const flow of flows.slice(0, 5)) { // Limitamos a 5 flujos para evitar demasiadas peticiones
                  try {
                    const processesResponse = await this.hiveflowClient.get(`/api/flows/${flow._id}/processes?limit=10`);
                    if (processesResponse.data && processesResponse.data.success) {
                      const processes = processesResponse.data.processes || [];
                      processes.forEach(process => {
                        allExecutions.push({
                          flowId: flow._id,
                          flowName: flow.name,
                          processId: process.processId,
                          status: process.status,
                          startTime: process.startTime,
                          endTime: process.endTime,
                          duration: process.duration
                        });
                      });
                    }
                  } catch (processError) {
                    console.error(`🔍 [DEBUG] Error obteniendo procesos para flujo ${flow._id}:`, processError.message);
                  }
                }
                
                return createValidResponse(allExecutions);
              } else {
                return createValidResponse([], 'No se pudieron obtener los flujos para buscar ejecuciones: ' + (flowsResponse.data?.message || 'Error desconocido'));
              }
            } catch (apiError) {
              let errorMessage = 'Error de conexión con el backend';
              if (apiError.code === 'ECONNREFUSED') {
                errorMessage = 'Backend no disponible. Asegúrate de que esté corriendo en ' + this.hiveflowClient.defaults.baseURL;
              }
              return createValidResponse([], errorMessage);
            }

          default:
            console.error(`🔍 [DEBUG] Recurso no encontrado: ${uri}`);
            // Manejar templates de recursos con parámetros
            if (uri.startsWith('hiveflow://flows/') && uri.includes('/executions')) {
              // Patrón: hiveflow://flows/{flowId}/executions
              const flowId = uri.replace('hiveflow://flows/', '').replace('/executions', '');
              console.error(`🔍 [DEBUG] Obteniendo ejecuciones para flujo específico: ${flowId}`);
              try {
                const response = await this.hiveflowClient.get(`/api/flows/${flowId}/processes`, {
                  params: { limit: 20 }
                });
                
                if (response.data && response.data.success) {
                  const processes = response.data.processes || [];
                  return createValidResponse(processes);
                } else {
                  return createValidResponse([], `No se pudieron obtener las ejecuciones del flujo ${flowId}: ` + (response.data?.message || 'Error desconocido'));
                }
              } catch (apiError) {
                let errorMessage = 'Error de conexión con el backend';
                if (apiError.code === 'ECONNREFUSED') {
                  errorMessage = 'Backend no disponible. Asegúrate de que esté corriendo en ' + this.hiveflowClient.defaults.baseURL;
                }
                return createValidResponse([], errorMessage);
              }
            } else if (uri.startsWith('hiveflow://flows/') && !uri.includes('/executions')) {
              // Patrón: hiveflow://flows/{flowId}
              const flowId = uri.replace('hiveflow://flows/', '');
              console.error(`🔍 [DEBUG] Obteniendo flujo específico: ${flowId}`);
              try {
                const response = await this.hiveflowClient.get(`/api/flows/${flowId}`);
                
                if (response.data && response.data.success) {
                  const flow = response.data.data || response.data.flow;
                  return createValidResponse(flow);
                } else {
                  return createValidResponse(null, `No se pudo obtener el flujo ${flowId}: ` + (response.data?.message || 'Error desconocido'));
                }
              } catch (apiError) {
                console.error(`🔍 [DEBUG] Error de API obteniendo flujo ${flowId}:`, {
                  message: apiError.message,
                  status: apiError.response?.status,
                  statusText: apiError.response?.statusText,
                  responseData: apiError.response?.data
                });
                
                let errorMessage = 'Error de conexión con el backend';
                if (apiError.code === 'ECONNREFUSED') {
                  errorMessage = 'Backend no disponible. Asegúrate de que esté corriendo en ' + this.hiveflowClient.defaults.baseURL;
                } else if (apiError.response?.status === 404) {
                  errorMessage = `Flujo con ID ${flowId} no encontrado`;
                } else if (apiError.response?.data?.message) {
                  errorMessage = apiError.response.data.message;
                }
                return createValidResponse(null, errorMessage);
              }
            } else {
              return createValidResponse({
                availableResources: [
                  'hiveflow://flows',
                  'hiveflow://mcp-servers', 
                  'hiveflow://executions'
                ],
                availableTemplates: [
                  'hiveflow://flows/{flowId}',
                  'hiveflow://flows/{flowId}/executions'
                ]
              }, `Recurso no encontrado: ${uri}`);
            }
        }
      } catch (error) {
        console.error(`🔍 [DEBUG] Error general en recursos:`, {
          message: error.message,
          stack: error.stack
        });
        
        const errorResult = createValidResponse(null, 'Error interno del servidor MCP: ' + error.message);
        console.error(`🔍 [DEBUG] Devolviendo resultado de error:`, errorResult);
        return errorResult;
      }
      } catch (criticalError) {
        console.error(`🔍 [DEBUG] ERROR CRÍTICO EN HANDLER:`, criticalError);
        // Respuesta de emergencia absoluta
        return {
          contents: [
            {
              uri: request?.params?.uri || 'unknown',
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Error crítico en el servidor MCP',
                message: criticalError.message,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }
    });
  }

  // Métodos de implementación de herramientas
  async createFlow(args) {
    const response = await this.hiveflowClient.post('/api/flows', {
      name: args.name,
      description: args.description,
      nodes: args.nodes || [],
      edges: [],
      status: 'draft'
    });
    
    const flow = response.data.data;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Flujo "${args.name}" creado exitosamente.\nID: ${flow._id}\nEstado: ${flow.status}`
        }
      ]
    };
  }

  async listFlows(args) {
    const params = {};
    if (args.status) params.status = args.status;
    if (args.limit) params.limit = args.limit;

    const response = await this.hiveflowClient.get('/api/flows', { params });
    const flows = response.data.data || [];
    
    const flowsList = flows.map(flow => 
      `• ${flow.name} (${flow._id}) - Estado: ${flow.status || 'draft'}`
    ).join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `📋 Flujos encontrados (${flows.length}):\n\n${flowsList || 'No hay flujos disponibles'}`
        }
      ]
    };
  }

  async getFlow(args) {
    const response = await this.hiveflowClient.get(`/api/flows/${args.flowId}`);
    const flow = response.data.flow;
    
    return {
      content: [
        {
          type: 'text',
          text: `📊 Detalles del flujo "${flow.name}":\n• ID: ${flow._id}\n• Estado: ${flow.status || 'draft'}\n• Nodos: ${flow.nodes?.length || 0}\n• Descripción: ${flow.description || 'Sin descripción'}\n• Última actualización: ${flow.updatedAt || 'N/A'}`
        }
      ]
    };
  }

  async executeFlow(args) {
    const response = await this.hiveflowClient.post(`/api/flows/${args.flowId}/execute`, {
      inputs: args.inputs || {}
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `🚀 Flujo ejecutado exitosamente.\nExecution ID: ${response.data.executionId || 'N/A'}\nEstado: ${response.data.status || 'iniciado'}`
        }
      ]
    };
  }

  async pauseFlow(args) {
    const response = await this.hiveflowClient.post(`/api/flows/${args.flowId}/pause`);
    
    return {
      content: [
        {
          type: 'text',
          text: `⏸️ Flujo pausado exitosamente.\nEstado: ${response.data.status || 'pausado'}`
        }
      ]
    };
  }

  async resumeFlow(args) {
    const response = await this.hiveflowClient.post(`/api/flows/${args.flowId}/resume`);
    
    return {
      content: [
        {
          type: 'text',
          text: `▶️ Flujo reanudado exitosamente.\nEstado: ${response.data.status || 'activo'}`
        }
      ]
    };
  }

  async listMCPServers() {
    const response = await this.hiveflowClient.get('/api/mcp/servers');
    const servers = response.data.servers || [];
    
    const serversList = servers.map(server => 
      `• ${server.name} - Estado: ${server.status} (${server.isConnected ? 'Conectado' : 'Desconectado'})`
    ).join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `🔌 Servidores MCP (${servers.length}):\n\n${serversList || 'No hay servidores MCP configurados'}`
        }
      ]
    };
  }

  async createMCPServer(args) {
    const response = await this.hiveflowClient.post('/api/mcp/servers', {
      name: args.name,
      command: args.command,
      args: args.args || [],
      description: args.description || ''
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Servidor MCP "${args.name}" registrado exitosamente.\nComando: ${args.command}\nEstado: registrado`
        }
      ]
    };
  }

  // ─── Blurb (mascota física): bridge local en http://127.0.0.1:4243, o la placa por USB ───
  blurbBridgeUrl() {
    return process.env.HIVEFLOW_BLURB_URL || `http://127.0.0.1:${process.env.BLURB_BRIDGE_PORT || 4243}`;
  }

  blurbSerialPath() {
    const fs = require('fs');
    for (const dir of ['/dev']) {
      try {
        const hit = fs.readdirSync(dir).find(n => /^cu\.usbmodem|^ttyACM/.test(n));
        if (hit) return `${dir}/${hit}`;
      } catch (e) { /* sin /dev (Windows) */ }
    }
    return null;
  }

  async blurbSend(path, body, rawLine) {
    try {
      const res = await axios.post(`${this.blurbBridgeUrl()}${path}`, body, { timeout: 2000 });
      return { content: [{ type: 'text', text: `✅ Blurb: ${JSON.stringify(body)} (via bridge) ${JSON.stringify(res.data)}` }] };
    } catch (e) {
      const dev = this.blurbSerialPath();
      if (!dev) throw new Error('no hay blurb-bridge en ' + this.blurbBridgeUrl() + ' ni placa por USB. Arranca `npx @hiveflow/blurb-bridge` o la app de escritorio → Ajustes → Hardware.');
      require('fs').writeFileSync(dev, JSON.stringify(rawLine) + '\n');
      return { content: [{ type: 'text', text: `✅ Blurb: ${JSON.stringify(rawLine)} (directo a ${dev})` }] };
    }
  }

  async blurbStatus() {
    try {
      const res = await axios.get(`${this.blurbBridgeUrl()}/status`, { timeout: 2000 });
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    } catch (e) {
      const dev = this.blurbSerialPath();
      return { content: [{ type: 'text', text: JSON.stringify({ bridge: false, board: dev, hint: dev ? 'placa conectada, sin bridge (modo directo)' : 'sin bridge ni placa' }, null, 2) }] };
    }
  }

  async getFlowExecutions(args) {
    try {
      const response = await this.hiveflowClient.get(`/api/flows/${args.flowId}/processes`, {
        params: { limit: args.limit || 10 }
      });
      
      if (response.data && response.data.success) {
        const processes = response.data.processes || [];
        
        const executionsList = processes.map(process => 
          `• ${process.processId || process._id} - Estado: ${process.status} - ${process.startTime} ${process.endTime ? `(${process.duration}ms)` : '(en progreso)'}`
        ).join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `📈 Ejecuciones del flujo (${processes.length}):\n\n${executionsList || 'No hay ejecuciones'}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${response.data?.message || 'No se pudieron obtener las ejecuciones'}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error de conexión: ${error.message}`
          }
        ]
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 HiveFlow MCP Server iniciado');
  }
}

// CLI principal
const program = new Command();

program
  .name('hiveflow-mcp')
  .description('HiveFlow MCP Server - Connect your AI assistant to HiveFlow')
  .version('1.0.0');

program
  .option('--api-url <url>', 'HiveFlow API URL', process.env.HIVEFLOW_API_URL || 'http://localhost:3001')
  .option('--api-key <key>', 'HiveFlow API Key', process.env.HIVEFLOW_API_KEY)
  .option('--instance-id <id>', 'HiveFlow Instance ID (for multi-tenant)', process.env.HIVEFLOW_INSTANCE_ID)
  .action(async (options) => {
    if (!options.apiKey) {
      console.error('❌ Error: HIVEFLOW_API_KEY is required');
      console.error('💡 Set the environment variable or use --api-key flag');
      process.exit(1);
    }

    const config = {
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
      instanceId: options.instanceId
    };

    const server = new HiveFlowMCPServer(config);
    await server.start();
  });

if (require.main === module) {
  program.parse();
}