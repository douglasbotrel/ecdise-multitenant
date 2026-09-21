'use client'

import { useEffect } from 'react'

/**
 * Trava a rolagem do fundo da página enquanto um modal/popup estiver aberto.
 *
 * Sem isso, em celular, o gesto de rolar o dedo dentro do popup às vezes
 * acaba rolando a página de trás em vez do conteúdo do popup — a pessoa
 * fica "presa" sem conseguir chegar no fim do formulário (ex: apontamento
 * financeiro, edição de contrato, etc.).
 *
 * Uso: dentro do componente do modal, chame `useLockBodyScroll(true)` se o
 * modal for um componente próprio (só existe montado quando aberto), ou
 * `useLockBodyScroll(algumEstadoBooleano)` se o modal for um bloco condicional
 * dentro de uma página maior.
 */
export function useLockBodyScroll(locked: boolean = true) {
  useEffect(() => {
    if (!locked) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}
