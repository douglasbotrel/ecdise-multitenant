import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados Ecdise...')

  // ============================================================
  // TIPOS DE CUSTO (Custos de Campo)
  // ============================================================
  const tiposCusto = [
    { nome: 'Combustível',                categoria: 'campo' },
    { nome: 'Pedágio',                    categoria: 'campo' },
    { nome: 'Estacionamento',             categoria: 'campo' },
    { nome: 'Diária de hotel / pousada',  categoria: 'campo' },
    { nome: 'Café da manhã',              categoria: 'campo' },
    { nome: 'Almoço',                     categoria: 'campo' },
    { nome: 'Jantar',                     categoria: 'campo' },
    { nome: 'Mecânica / Socorro eventual', categoria: 'campo' },
    { nome: 'Material Escritório',        categoria: 'escritorio' },
    { nome: 'Material Vistoria',          categoria: 'campo' },
    { nome: 'Outros',                     categoria: 'geral' },
  ]

  for (const custo of tiposCusto) {
    await prisma.tipoCusto.upsert({
      where:  { nome: custo.nome },
      update: custo,
      create: custo,
    })
  }
  console.log('✅ Tipos de custo criados')

  // ============================================================
  // USUÁRIOS — administradores do sistema
  // ============================================================
  const usuarios = [
    {
      nome:         'Douglas',
      email:        'douglas@ecdise.com',
      senha:        'Douglas@2024',
      cargo:        'Administrador',
      role:         'ADMIN',
      departamento: 'GESTAO_GERAL',
    },
    {
      nome:         'Bruno',
      email:        'bruno@ecdise.com',
      senha:        'Bruno@2024',
      cargo:        'Administrador',
      role:         'ADMIN',
      departamento: 'GESTAO_GERAL',
    },
  ]

  for (const u of usuarios) {
    const senhaHash = await bcrypt.hash(u.senha, 10)
    await prisma.usuario.upsert({
      where:  { email: u.email },
      update: { nome: u.nome, cargo: u.cargo, ativo: true },
      create: {
        nome:         u.nome,
        email:        u.email,
        senha:        senhaHash,
        cargo:        u.cargo,
        role:         u.role,
        departamento: u.departamento,
        ativo:        true,
      },
    })
  }
  console.log('✅ Usuários criados')

  console.log('\n🎉 Seed concluído!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Douglas: douglas@ecdise.com  |  Douglas@2024')
  console.log('   Bruno:   bruno@ecdise.com    |  Bruno@2024')
  console.log('\n⚠️  Altere as senhas após o primeiro acesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
