package org.jjazz.web.engine.platform.util;

import java.util.AbstractSet;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.NavigableSet;
import java.util.Objects;
import java.util.SortedSet;
import java.util.function.Predicate;

public final class SortedSetViews
{
    private SortedSetViews()
    {
    }

    public static <E> SortedSet<E> unmodifiableSortedSet(SortedSet<E> set)
    {
        return new SortedView<>(set);
    }

    public static <E> NavigableSet<E> unmodifiableNavigableSet(NavigableSet<E> set)
    {
        return new NavigableView<>(set);
    }

    private static class SortedView<E> extends AbstractSet<E> implements SortedSet<E>
    {
        private final SortedSet<E> set;

        SortedView(SortedSet<E> set)
        {
            this.set = Objects.requireNonNull(set);
        }

        @Override
        public int size()
        {
            return set.size();
        }

        @Override
        public boolean contains(Object value)
        {
            return set.contains(value);
        }

        @Override
        public Iterator<E> iterator()
        {
            return Collections.unmodifiableCollection(set).iterator();
        }

        @Override
        public boolean addAll(Collection<? extends E> values)
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public boolean remove(Object value)
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public boolean removeAll(Collection<?> values)
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public boolean retainAll(Collection<?> values)
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public boolean removeIf(Predicate<? super E> filter)
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public void clear()
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public Comparator<? super E> comparator()
        {
            return set.comparator();
        }

        @Override
        public E first()
        {
            return set.first();
        }

        @Override
        public E last()
        {
            return set.last();
        }

        @Override
        public SortedSet<E> subSet(E from, E to)
        {
            return unmodifiableSortedSet(set.subSet(from, to));
        }

        @Override
        public SortedSet<E> headSet(E to)
        {
            return unmodifiableSortedSet(set.headSet(to));
        }

        @Override
        public SortedSet<E> tailSet(E from)
        {
            return unmodifiableSortedSet(set.tailSet(from));
        }
    }

    private static final class NavigableView<E> extends SortedView<E> implements NavigableSet<E>
    {
        private final NavigableSet<E> set;

        NavigableView(NavigableSet<E> set)
        {
            super(set);
            this.set = set;
        }

        @Override
        public E lower(E value)
        {
            return set.lower(value);
        }

        @Override
        public E floor(E value)
        {
            return set.floor(value);
        }

        @Override
        public E ceiling(E value)
        {
            return set.ceiling(value);
        }

        @Override
        public E higher(E value)
        {
            return set.higher(value);
        }

        @Override
        public E pollFirst()
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public E pollLast()
        {
            throw new UnsupportedOperationException();
        }

        @Override
        public NavigableSet<E> descendingSet()
        {
            return unmodifiableNavigableSet(set.descendingSet());
        }

        @Override
        public Iterator<E> descendingIterator()
        {
            return descendingSet().iterator();
        }

        @Override
        public NavigableSet<E> subSet(E from, boolean fromInclusive, E to, boolean toInclusive)
        {
            return unmodifiableNavigableSet(set.subSet(from, fromInclusive, to, toInclusive));
        }

        @Override
        public NavigableSet<E> headSet(E to, boolean inclusive)
        {
            return unmodifiableNavigableSet(set.headSet(to, inclusive));
        }

        @Override
        public NavigableSet<E> tailSet(E from, boolean inclusive)
        {
            return unmodifiableNavigableSet(set.tailSet(from, inclusive));
        }
    }
}
