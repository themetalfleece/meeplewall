import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { routes, validateUsername } from '@/lib/route-params';

/** State for the "open a collection" form: the typed name, its error, and the handlers. */
export function useUsernameForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: { target: { value: string } }) {
    setValue(event.target.value);
    setError(null);
  }

  function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const username = validateUsername(value);
    if (username === null) {
      setError('Enter a BoardGameGeek username.');
      return;
    }
    router.push(routes.collection(username));
  }

  return { value, error, handleChange, handleSubmit };
}
