# Ecdise — Sistema de Gestão de Licenciamento Ambiental

<!-- redeploy forçado -->
Sistema ERP/CRM completo para empresas de consultoria ambiental, cobrindo toda a jornada do projeto: do lead comercial ao encerramento do contrato.

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org) v18 ou superior
- [Git](https://git-scm.com)

### 1. Instalar dependências
```bash
cd Ecdise
npm install
```

### 2. Configurar variáveis de ambiente
```bash
# O arquivo .env já está criado com SQLite para desenvolvimento
# Para produção, copie e edite o .env.example
cp .env.example .env
```

### 3. Configurar banco de dados (SQLite para dev)
```bash
# Gera o cliente Prisma
npm run db:generate

# Cria as tabelas no banco
npm run db:push

# Popula com dados iniciais (tipos de serviço, usuários, etc.)
npm run db:seed
```

### 4. Rodar o projeto
```bash
npm run dev
```

Acesse: **http://localhost:3000**

### Credenciais de acesso (desenvolvimento)
| Usuário | Email | Senha | Perfil |
|---------|-------|-------|--------|
| Admin | admin@ecdise.com | admin@ecdise2024 | Administrador (acesso total) |
| Gestor | gestor@ecdise.com | gestor@ecdise2024 | Gestor Geral |
| Analista | analista@ecdise.com | analista@ecdise2024 | Analista Ambiental |

---

## 🗂️ Estrutura do Projeto

```
Ecdise/
├── prisma/
│   ├── schema.prisma        # Schema do banco de dados
│   └── seed.ts              # Dados iniciais (pré-cadastros, admin)
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login
│   │   ├── (dashboard)/     # Módulos principais
│   │   │   ├── dashboard/   # Dashboard gerencial
│   │   │   ├── comercial/   # Gestão comercial / leads
│   │   │   ├── contratos/   # Gestão de contratos
│   │   │   ├── operacional/ # Gerenciamento operacional + linha do tempo
│   │   │   ├── campo/       # Gestão de campo / vistorias
│   │   │   ├── financeiro/  # Controle financeiro
│   │   │   ├── encerramento/# Checklist de encerramento
│   │   │   ├── bi/          # BI / Relatórios
│   │   │   └── configuracoes/ # Usuários e pré-cadastros
│   │   └── api/             # APIs REST
│   ├── components/
│   │   ├── layout/          # Sidebar, Header
│   │   └── modals/          # Modais de formulário
│   ├── lib/
│   │   ├── auth.ts          # JWT + autenticação
│   │   ├── prisma.ts        # Cliente do banco
│   │   └── utils.ts         # Utilitários
│   └── middleware.ts        # Proteção de rotas
```

---

## 📦 Módulos do Sistema

| Módulo | Descrição |
|--------|-----------|
| **Comercial** | Cadastro de leads, status comercial, aprovação para contrato |
| **Contratos** | Gestão de contratos com parcelamento automático |
| **Operacional** | Linha do tempo de projetos, tarefas por etapa |
| **Campo** | Agendamento e registro de vistorias, controle de gastos |
| **Financeiro** | Controle de recebimentos, registro de pagamentos |
| **Encerramento** | Checklist de finalização de projetos |
| **BI** | Dashboard com gráficos, indicadores e métricas |
| **Configurações** | Usuários, permissões, pré-cadastros configuráveis |

---

## 🛠️ Stack Tecnológica

- **Frontend:** Next.js 14 (App Router) + React + TypeScript
- **Estilo:** Tailwind CSS
- **Banco:** SQLite (dev) / PostgreSQL (produção)
- **ORM:** Prisma
- **Auth:** JWT com cookies HttpOnly
- **Gráficos:** Recharts

---

## 🔐 Hierarquia de Permissões

```
ADMIN > GESTOR_GERAL > GESTOR_ADMINISTRATIVO > GESTOR_OPERACIONAL > 
GESTOR_CAMPO > SUPERVISOR > ANALISTA > TECNICO_CAMPO
```

---

## 🗄️ Para usar PostgreSQL em produção

1. Altere o `DATABASE_URL` no `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/ecdise?schema=public"
```

2. Altere o provider no `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // <- mude de "sqlite"
  url      = env("DATABASE_URL")
}
```

3. Rode as migrações:
```bash
npm run db:migrate
npm run db:seed
```

---

## 📋 Scripts disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run db:generate  # Gerar cliente Prisma
npm run db:push      # Sincronizar schema (dev)
npm run db:migrate   # Criar migração (prod)
npm run db:seed      # Popular banco com dados iniciais
npm run db:studio    # Interface visual do banco (Prisma Studio)
```
