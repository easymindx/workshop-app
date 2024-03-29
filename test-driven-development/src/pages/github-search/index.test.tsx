import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import GithubSearchPage from '.';
import {
  getReposList,
  makeFakeError,
  makeFakeRepo,
  makeFakeResponse,
} from '../../__fixtures__/repos';
import {
  ERROR_SERVER_STATUS,
  OK_STATUS,
  UNPROCESSABLE_STATUS,
} from '../../consts/httpStatus';

const server = setupServer(
  rest.get('/search/repositories', (req, res, ctx) => {
    return res(
      ctx.status(OK_STATUS),
      ctx.json(makeFakeResponse(100, [makeFakeRepo()])),
    );
  }),
);

beforeAll(() => server.listen());

beforeEach(() => render(<GithubSearchPage />));

afterAll(() => server.close());

afterEach(() => server.resetHandlers());

const fireClickSearch = () =>
  fireEvent.click(screen.getByRole('button', { name: /search/i }));

describe('render GithubSearchPage', () => {
  it('must display the title', () => {
    expect(
      screen.getByRole('heading', { name: /github repositories list/i }),
    ).toBeInTheDocument();
  });

  it('must be an input text with label "filter by" field', () => {
    expect(screen.getByLabelText(/filter by/i)).toBeInTheDocument();
  });

  it('there should be a search button', () => {
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('should show initial search status message', () => {
    expect(
      screen.getByText(
        /please provide a search option and click in the search button/i,
      ),
    ).toBeInTheDocument();
  });
});

describe('when a search is performed', () => {
  it('the search button should be disabled until the search is done', async () => {
    const submitBtn = screen.getByRole('button', { name: /search/i });

    expect(submitBtn).not.toBeDisabled();
    fireClickSearch();
    expect(submitBtn).toBeDisabled();

    await waitFor(() => expect(submitBtn).not.toBeDisabled());
  });

  it('the data should be displayed as a sticky table', async () => {
    fireClickSearch();

    await waitFor(() =>
      expect(
        screen.queryByText(
          /please provide a search option and click in the search button/i,
        ),
      ).not.toBeInTheDocument(),
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('the table headers must contain: repository, stars, forks, open issues and updated at', async () => {
    fireClickSearch();

    const table = await screen.findByRole('table');
    const tableHeaders = within(table).getAllByRole('columnheader');

    expect(tableHeaders).toHaveLength(5);

    const [repository, stars, forks, openIssues, updatedAt] = tableHeaders;

    expect(repository).toHaveTextContent(/repository/i);
    expect(stars).toHaveTextContent(/stars/i);
    expect(forks).toHaveTextContent(/forks/i);
    expect(openIssues).toHaveTextContent(/open issues/i);
    expect(updatedAt).toHaveTextContent(/updated at/i);
  });

  it(`each table result should have: owner avatar image, name, stars, updated at, forks, open issues,
      column repository should have a link that opens in a new tab the github repository selected`, async () => {
    fireClickSearch();

    const table = await screen.findByRole('table');
    const tableCell = within(table).getAllByRole('cell');
    const [repository, stars, forks, openIssues, updatedAt] = tableCell;
    const avatarImg = within(repository).getByRole('img', {
      name: makeFakeRepo().name,
    });

    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', makeFakeRepo().owner.avatar_url);

    expect(tableCell).toHaveLength(5);

    expect(repository).toHaveTextContent(makeFakeRepo().name);
    expect(stars).toHaveTextContent(makeFakeRepo().stargazers_count.toString());
    expect(forks).toHaveTextContent(makeFakeRepo().forks_count.toString());
    expect(openIssues).toHaveTextContent(
      makeFakeRepo().open_issues_count.toString(),
    );
    expect(updatedAt).toHaveTextContent(makeFakeRepo().updated_at);

    expect(
      within(repository).getByText(makeFakeRepo().name).closest('a'),
    ).toHaveAttribute('href', makeFakeRepo().html_url);
  });

  it('show the total number of search results and the current number of results [1-10 of 100]', async () => {
    fireClickSearch();

    await screen.findByRole('table');
    expect(screen.getByText(/1–10 of 100/i)).toBeInTheDocument();
  });

  it('results size per page select/combobox with the options: 10, 25, 50. the default is 10', async () => {
    fireClickSearch();

    await screen.findByRole('table');
    expect(screen.getByLabelText(/rows per page/i)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText(/rows per page/i));

    const listbox = screen.getByRole('listbox', { name: /rows per page/i });
    const options = within(listbox).getAllByRole('option');
    const [firstOpt, secondOpt, thirdOption] = options;

    expect(options).toHaveLength(3);
    expect(firstOpt).toHaveTextContent(/10/);
    expect(secondOpt).toHaveTextContent(/25/);
    expect(thirdOption).toHaveTextContent(/50/);
  });

  it('previous and next page buttons should exist', async () => {
    fireClickSearch();

    await screen.findByRole('table');

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    const nextButton = screen.getByRole('button', { name: /next page/i });

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(prevButton).toBeDisabled();
  });
});

describe('if there are no results in the search', () => {
  it('show a empty state message', async () => {
    server.use(
      rest.get('/search/repositories', (req, res, ctx) => {
        return res(ctx.status(OK_STATUS), ctx.json(makeFakeResponse()));
      }),
    );

    fireClickSearch();

    await waitFor(() =>
      expect(
        screen.getByText(/you search has no results/i),
      ).toBeInTheDocument(),
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('when a search is done', () => {
  it('must display the related repos', async () => {
    const searchValue = 'python';
    const expectedRepo = getReposList(searchValue)[0];

    server.use(
      rest.get('/search/repositories', (req, res, ctx) => {
        return res(
          ctx.status(OK_STATUS),
          ctx.json({
            ...makeFakeResponse(),
            items: getReposList(req.url.searchParams.get('q') || searchValue),
          }),
        );
      }),
    );

    fireEvent.change(screen.getByLabelText(/filter by/i), {
      target: { value: searchValue },
    });

    fireClickSearch();

    const table = await screen.findByRole('table');
    const tableCells = within(table).getAllByRole('cell');
    const [repository] = tableCells;

    expect(repository).toHaveTextContent(expectedRepo.name);
  });
});

describe('when there is an unexpected error from the backend', () => {
  it('must display an alert message error with the message from the server', async () => {
    expect(screen.queryByText(/validation failed/i)).not.toBeInTheDocument();

    server.use(
      rest.get('/search/repositories', (req, res, ctx) => {
        return res(ctx.status(UNPROCESSABLE_STATUS), ctx.json(makeFakeError()));
      }),
    );

    fireClickSearch();

    expect(await screen.findByText(/validation failed/i)).toBeVisible();
  });

  it('must display an alert message error with the message from the server', async () => {
    expect(screen.queryByText(/unexpected error/i)).not.toBeInTheDocument();

    server.use(
      rest.get('/search/repositories', (req, res, ctx) => {
        return res(
          ctx.status(ERROR_SERVER_STATUS),
          ctx.json(makeFakeError('unexpected error')),
        );
      }),
    );

    fireClickSearch();

    expect(await screen.findByText(/unexpected error/i)).toBeVisible();
  });
});
